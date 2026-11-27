const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "access-control-allow-origin": "*" }
});
const clean = (s = "") => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim().slice(0, 1200);
const tag = (xml, name) => {
  const m = xml.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return m ? clean(m[1]) : "";
};
function itemsFrom(xml) {
  const rss = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(x => x[1]);
  const atom = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map(x => x[1]);
  return (rss.length ? rss : atom).slice(0, 40).map(x => {
    const linkTag = x.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i);
    const linkText = tag(x, "link");
    const guid = tag(x, "guid") || tag(x, "id") || linkTag?.[1] || linkText;
    return { key: guid || tag(x, "title"), url: linkTag?.[1] || linkText,
      title: tag(x, "title"), summary: tag(x, "description") || tag(x, "summary") || tag(x, "content"),
      date: tag(x, "pubDate") || tag(x, "published") || tag(x, "updated") };
  }).filter(x => x.key && x.title && /^https?:\/\//i.test(x.url));
}
async function ingest(env) {
  let sources;
  try { sources = JSON.parse(env.SOURCES_JSON || "[]"); } catch { return { error: "SOURCES_JSON is invalid" }; }
  if (!Array.isArray(sources)) return { error: "SOURCES_JSON must be an array" };
  let fetched = 0, inserted = 0, failed = 0;
  for (const s of sources.filter(x => x && x.enabled === true && /^https:\/\//.test(x.feed_url || ""))) {
    try {
      const res = await fetch(s.feed_url, { headers: { "user-agent": "DAHLEEZ-Newsroom/0.1 (+editorial contact)" },
        cf: { cacheTtl: 300, cacheEverything: true } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const xml = await res.text(); fetched++;
      const sourceId = String(s.id || s.name).slice(0, 100);
      await env.DB.prepare("INSERT OR IGNORE INTO sources(id,name,feed_url,category,enabled) VALUES(?,?,?,?,1)")
        .bind(sourceId, String(s.name || sourceId), s.feed_url, String(s.category || "world")).run();
      for (const item of itemsFrom(xml)) {
        const id = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceId + "|" + item.key));
        const storyId = [...new Uint8Array(id)].map(b => b.toString(16).padStart(2,"0")).join("");
        const result = await env.DB.prepare("INSERT OR IGNORE INTO stories(id,source_id,source_item_id,source_url,title,summary,category,published_at) VALUES(?,?,?,?,?,?,?,?)")
          .bind(storyId, sourceId, item.key.slice(0,500), item.url, item.title, item.summary, String(s.category || "world"), item.date || null).run();
        inserted += result.meta?.changes || 0;
      }
    } catch (e) { failed++; console.error("feed ingestion failed", s.name, String(e)); }
  }
  return { fetched, inserted, failed };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: {
      "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "authorization,content-type" } });
    if (url.pathname === "/api/health") return json({ service: "DAHLEEZ newsroom", status: "online", mode: "starter", publishing: false });
    if (url.pathname === "/api/stories" && request.method === "GET") {
      const select = "SELECT stories.id,stories.title,stories.summary,stories.category,stories.published_at,stories.source_url,sources.name AS source_name FROM stories JOIN sources ON sources.id=stories.source_id WHERE stories.status='approved'";
      const id = url.searchParams.get("id");
      if (id) {
        const story = await env.DB.prepare(select + " AND stories.id=? LIMIT 1").bind(id).first();
        return story ? json({ story }) : json({ error: "Story not found" }, 404);
      }
      const requestedLimit = Number(url.searchParams.get("limit") || 9);
      const requestedOffset = Number(url.searchParams.get("offset") || 0);
      const limit = Number.isFinite(requestedLimit) ? Math.min(30, Math.max(1, Math.trunc(requestedLimit))) : 9;
      const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.min(10000, Math.trunc(requestedOffset))) : 0;
      const category = (url.searchParams.get("category") || "").slice(0, 40);
      const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
      let sql = select, binds = [];
      if (category) { sql += " AND stories.category=?"; binds.push(category); }
      if (query) { sql += " AND (stories.title LIKE ? OR stories.summary LIKE ?)"; binds.push("%" + query + "%", "%" + query + "%"); }
      sql += " ORDER BY COALESCE(stories.published_at,stories.fetched_at) DESC LIMIT ? OFFSET ?";
      binds.push(limit, offset);
      const { results } = await env.DB.prepare(sql).bind(...binds).all();
      return json({ stories: results || [], limit, offset });
    }
    if (url.pathname === "/api/admin/refresh" && request.method === "POST") {
      if (!env.ADMIN_TOKEN || request.headers.get("authorization") !== "Bearer " + env.ADMIN_TOKEN) return json({ error: "Unauthorized" }, 401);
      const result = await ingest(env);
      if (result.error) return json(result, 500);
      return json({ ok: true, ...result });
    }
    if (url.pathname === "/api/admin/review" && request.method === "GET") {
      if (!env.ADMIN_TOKEN || request.headers.get("authorization") !== "Bearer " + env.ADMIN_TOKEN) return json({ error: "Unauthorized" }, 401);
      const { results } = await env.DB.prepare("SELECT stories.*,sources.name AS source_name FROM stories JOIN sources ON sources.id=stories.source_id WHERE stories.status='pending' ORDER BY stories.fetched_at DESC LIMIT 100").all();
      const counts = await env.DB.prepare("SELECT status,COUNT(*) AS total FROM stories GROUP BY status").all();
      const sources = await env.DB.prepare("SELECT COUNT(*) AS total,COALESCE(SUM(enabled),0) AS enabled FROM sources").first();
      return json({ pending: results || [], counts: counts.results || [], sources: sources || { total: 0, enabled: 0 } });
    }
    if (url.pathname === "/api/admin/decision" && request.method === "POST") {
      if (!env.ADMIN_TOKEN || request.headers.get("authorization") !== "Bearer " + env.ADMIN_TOKEN) return json({ error: "Unauthorized" }, 401);
      const body = await request.json().catch(() => null);
      if (!body?.id || !["approved","rejected"].includes(body.status)) return json({ error: "Invalid decision" }, 400);
      const result = await env.DB.prepare("UPDATE stories SET status=? WHERE id=? AND status='pending'").bind(body.status, body.id).run();
      if (!result.meta?.changes) return json({ error: "Story not found or already reviewed" }, 404);
      await env.DB.prepare("INSERT INTO audit_log(story_id,action,actor,note) VALUES(?,?,?,?)")
        .bind(body.id, body.status, "editor", String(body.note || "").slice(0,500)).run();
      return json({ ok: true, status: body.status });
    }
    return json({ error: "Not found" }, 404);
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(ingest(env)); }
};
