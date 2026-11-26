const nav=document.getElementById('mainNav');
document.getElementById('menuToggle').addEventListener('click',()=>nav.classList.toggle('open'));
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
const panel=document.getElementById('searchPanel');
document.getElementById('searchToggle').addEventListener('click',()=>{panel.hidden=false;document.getElementById('searchInput').focus()});
document.getElementById('searchClose').addEventListener('click',()=>{panel.hidden=true});
document.getElementById('year').textContent=new Date().getFullYear();
const date=new Intl.DateTimeFormat('ar',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
document.getElementById('todayDate').textContent=date;
document.addEventListener('keydown',e=>{if(e.key==='Escape')panel.hidden=true});
async function loadApprovedStories(){
 const target=document.getElementById('liveStories'); if(!target)return;
 try{
  const response=await fetch('/api/stories?limit=8',{headers:{accept:'application/json'}});
  if(!response.ok)return;
  const data=await response.json(); const stories=Array.isArray(data.stories)?data.stories:[];
  if(!stories.length)return;
  target.hidden=false; target.replaceChildren();
  const heading=document.createElement('h2'); heading.textContent='آخر الأخبار المعتمدة'; target.append(heading);
  const grid=document.createElement('div'); grid.className='live-grid';
  for(const story of stories){
   const card=document.createElement('article'); card.className='live-card';
   const category=document.createElement('span'); category.className='category'; category.textContent=story.category||'أخبار';
   const title=document.createElement('h3'); title.textContent=story.title;
   const summary=document.createElement('p'); summary.textContent=story.summary||'';
   const source=document.createElement('a'); source.href=story.source_url; source.target='_blank'; source.rel='noopener noreferrer'; source.textContent='المصدر: '+(story.source_name||'المصدر الأصلي');
   card.append(category,title,summary,source); grid.append(card);
  }
  target.append(grid);
 }catch(_){/* API is optional until the newsroom backend is deployed. */}
}
loadApprovedStories();
