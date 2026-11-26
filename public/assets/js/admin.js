const tokenInput=document.getElementById('token'), statusEl=document.getElementById('status'), itemsEl=document.getElementById('items');
let adminToken='';
const headers=()=>({authorization:'Bearer '+adminToken,'content-type':'application/json'});
function status(s){statusEl.textContent=s}
async function request(path,options={}){
  if(!/^[\x21-\x7E]+$/.test(adminToken)){
    throw new Error('رمز الإدارة يحتوي أحرفاً غير صالحة. أعد نسخه كما هو من Cloudflare، وتأكد أن لوحة المفاتيح لا تضيف أحرفاً عربية أو مسافات.');
  }
  const r=await fetch(path,{...options,headers:{...headers(),...(options.headers||{})}});
  const data=await r.json().catch(()=>({error:'استجابة غير مفهومة'}));
  if(!r.ok)throw new Error(data.error||('HTTP '+r.status));
  return data;
}
async function load(){
  if(!adminToken){status('أدخل رمز الإدارة أولاً.');return}
  status('جارٍ تحميل القائمة...');itemsEl.textContent='جارٍ التحميل...';
  try{const data=await request('/api/admin/review');render(data.pending||[]);status('تم الاتصال. عدد المواد المعلّقة: '+(data.pending||[]).length)}
  catch(e){itemsEl.textContent='تعذر تحميل القائمة.';status('فشل الاتصال: '+e.message)}
}
function render(rows){
  itemsEl.replaceChildren();
  if(!rows.length){itemsEl.className='admin-empty';itemsEl.textContent='لا توجد مواد معلّقة حالياً.';return}
  itemsEl.className='';
  for(const row of rows){
    const box=document.createElement('article');box.className='pending';
    const title=document.createElement('h3');title.textContent=row.title;
    const summary=document.createElement('p');summary.textContent=row.summary||'لا يوجد ملخص من المصدر.';
    const meta=document.createElement('p');meta.textContent='المصدر: '+(row.source_name||'غير معروف')+' | التصنيف: '+row.category+' | تاريخ المصدر: '+(row.published_at||'غير محدد');
    const link=document.createElement('a');link.href=row.source_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='فتح المصدر الأصلي';
    const actions=document.createElement('div');actions.className='pending-actions';
    for(const [label,decision,cls] of [['اعتماد للموقع','approved',''],['رفض','rejected','reject']]){
      const b=document.createElement('button');b.className='admin-btn '+cls;b.textContent=label;b.addEventListener('click',()=>decide(row.id,decision,b));actions.append(b)
    }
    box.append(title,summary,meta,link,actions);itemsEl.append(box)
  }
}
async function decide(id,decision,button){
  if(!confirm(decision==='approved'?'هل تحققت من الخبر ومصدره وتريد نشره على الموقع؟':'تأكيد رفض هذه المادة؟'))return;
  button.disabled=true;
  try{await request('/api/admin/decision',{method:'POST',body:JSON.stringify({id,status:decision})});await load()}
  catch(e){status('تعذر تنفيذ القرار: '+e.message);button.disabled=false}
}
document.getElementById('connect').addEventListener('click',()=>{
  adminToken=tokenInput.value.trim();
  if(!adminToken){status('أدخل رمز الإدارة.');return}
  if(!/^[\x21-\x7E]+$/.test(adminToken)){status('رمز الإدارة يجب أن يحتوي أحرفاً إنجليزية وأرقاماً ورموزاً لاتينية فقط. أعد نسخه من Cloudflare.');return}
  load()
});
document.getElementById('refresh').addEventListener('click',load);
document.getElementById('clear').addEventListener('click',()=>{
  adminToken='';tokenInput.value='';itemsEl.textContent='تم مسح الرمز من ذاكرة الصفحة.';status('تم قطع الاتصال.')
});
