'use strict';
const $=s=>document.querySelector(s);
const pages={posts:1,comments:1};
let activeTab='site';
const labels={brand:'網站名稱',badge:'右上角標籤',eyebrow:'英文小標',hero_line1:'首頁大標第一行',hero_line2:'首頁大標第二行',hero_description:'首頁說明',card_title:'右側卡片標題',card_description:'右側卡片說明',board_title:'文章區標題',board_description:'文章區說明',footer:'頁尾文字'};
function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;}
function notify(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove('show'),3600);}
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});let d;try{d=await r.json();}catch{throw Error('伺服器回應異常');}if(!r.ok)throw Error(d.error||'操作失敗');return d;}
function control(text,fn,css='ghost'){const b=element('button',css,text);b.type='button';b.addEventListener('click',fn);return b;}
function cardTitle(text){return element('strong','admin-title',text);}
function info(text){return element('p','fine',text);}
function renderError(target,e){target.replaceChildren(element('p','empty',e.message));}
async function runAction(message,callback,reload){if(!confirm(message))return;try{await callback();notify('操作成功');await reload();}catch(e){notify('失敗：'+e.message);}}
function itemActions(type,item,reload){
 const row=element('div','admin-item-actions');
 row.append(control(item.hidden?'恢復公開':'隱藏',()=>runAction(`確定要${item.hidden?'恢復公開':'隱藏'}這則${type==='post'?'文章':'留言'}？`,()=>api(`/api/admin/content/${type}/${item.id}`,{method:'PATCH',body:JSON.stringify({hidden:!item.hidden})}),reload)));
 row.append(control('永久刪除',async()=>{
  const phrase=type==='post'?'刪除文章':'刪除留言';
  const scope=type==='post'?'（包含該文章的所有留言）':'';
  if(prompt(`即將永久刪除 #${item.id}${scope}。此操作無法復原。\n請輸入「${phrase}」確認：`)!==phrase)return;
  try{await api(`/api/admin/content/${type}/${item.id}`,{method:'DELETE'});notify('已永久刪除');await reload();}catch(e){notify('刪除失敗：'+e.message);}
 },'danger-btn'));
 return row;
}
async function loadSite(){const target=$('#siteFields');target.replaceChildren(info('正在讀取網站文字...'));try{
 const {settings}=await api('/api/admin/site-settings');target.replaceChildren();
 for(const [key,label] of Object.entries(labels)){
  const wrap=element('label','admin-field');const title=element('span','',label);
  const input=(key.endsWith('description')?'textarea':'input');
  const field=element(input,'');field.name=key;field.value=settings[key]||'';field.required=true;field.maxLength=350;
  if(input==='textarea')field.rows=3;
  wrap.append(title,field);target.append(wrap);
 }
}catch(e){renderError(target,e);}}
$('#siteForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;try{const settings=Object.fromEntries([...new FormData(e.currentTarget)].map(([k,v])=>[k,v.trim()]));await api('/api/admin/site-settings',{method:'PUT',body:JSON.stringify({settings})});notify('首頁文字已儲存，重新開啟首頁即可看到。');}catch(err){notify('儲存失敗：'+err.message);}finally{button.disabled=false;}});
async function loadPosts(){const target=$('#adminPosts');target.replaceChildren(info('載入文章中...'));try{
 const data=await api(`/api/admin/posts?page=${pages.posts}`);target.replaceChildren();
 if(!data.posts.length)target.append(info('沒有文章。'));
 for(const item of data.posts){const card=element('article','admin-item');card.append(element('span','tag',item.hidden?'已隱藏':'公開中'),cardTitle(`#${item.id} · ${item.title}`),info(`${item.category} · ${item.created_at} · ${item.comments_count} 則留言`),element('p','admin-body',item.body),itemActions('post',item,loadPosts));target.append(card);}
 $('#postPage').textContent=`第 ${data.page} / ${data.pages} 頁 · 共 ${data.total} 篇`;$('#postPrev').disabled=pages.posts===1;$('#postNext').disabled=pages.posts>=data.pages;
 if(data.posts.length===0&&pages.posts>1){pages.posts--;return loadPosts();}
}catch(e){renderError(target,e);}}
async function loadComments(){const target=$('#adminComments');target.replaceChildren(info('載入留言中...'));try{
 const data=await api(`/api/admin/comments?page=${pages.comments}`);target.replaceChildren();
 if(!data.comments.length)target.append(info('沒有留言。'));
 for(const item of data.comments){const card=element('article','admin-item');card.append(element('span','tag',item.hidden?'已隱藏':'公開中'),cardTitle(`留言 #${item.id} · 文章 #${item.post_id}`),info(item.post_title+' · '+item.created_at),element('p','admin-body',item.body),itemActions('comment',item,loadComments));target.append(card);}
 $('#commentPage').textContent=`第 ${data.page} / ${data.pages} 頁 · 共 ${data.total} 則`;$('#commentPrev').disabled=pages.comments===1;$('#commentNext').disabled=pages.comments>=data.pages;
 if(data.comments.length===0&&pages.comments>1){pages.comments--;return loadComments();}
}catch(e){renderError(target,e);}}
async function loadReports(){const target=$('#reports');target.replaceChildren(info('載入檢舉中...'));try{
 const {reports}=await api('/api/admin/reports');target.replaceChildren();if(!reports.length)target.append(info('目前沒有待處理檢舉。'));
 for(const r of reports){const card=element('article','admin-item');card.append(cardTitle(`檢舉 #${r.id} · ${r.target_type==='post'?'文章':'留言'} #${r.target_id}`),info(r.created_at),element('p','admin-body',r.target_excerpt||'（內容不存在）'),info('檢舉原因：'+r.reason));const actions=element('div','admin-item-actions');
 actions.append(control('隱藏內容',()=>runAction('確定隱藏這個內容？',()=>api('/api/admin/hide',{method:'POST',body:JSON.stringify({type:r.target_type,id:r.target_id})}),loadReports)),control('標記已處理',()=>runAction('將此檢舉標記為已處理？',()=>api('/api/admin/resolve',{method:'POST',body:JSON.stringify({id:r.id})}),loadReports)));
 card.append(actions);target.append(card);}
}catch(e){renderError(target,e);}}
const loaders={site:loadSite,posts:loadPosts,comments:loadComments,reports:loadReports};
function showTab(tab){activeTab=tab;for(const button of document.querySelectorAll('[data-tab]')){const selected=button.dataset.tab===tab;button.classList.toggle('selected',selected);button.setAttribute('aria-selected',String(selected));}for(const panel of document.querySelectorAll('.admin-panel'))panel.hidden=panel.id!==`panel-${tab}`;loaders[tab]();}
for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>showTab(button.dataset.tab));
for(const button of document.querySelectorAll('[data-refresh]'))button.addEventListener('click',()=>loaders[button.dataset.refresh]());
$('#postPrev').addEventListener('click',()=>{if(pages.posts>1){pages.posts--;loadPosts();}});
$('#postNext').addEventListener('click',()=>{pages.posts++;loadPosts();});
$('#commentPrev').addEventListener('click',()=>{if(pages.comments>1){pages.comments--;loadComments();}});
$('#commentNext').addEventListener('click',()=>{pages.comments++;loadComments();});
showTab('site');
