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
const focusId={posts:0,comments:0};
const expanded={posts:new Set(),comments:new Set()};
const requestVersion={posts:0,comments:0};
function twDate(value){if(!value)return '';const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);}
function categoryTag(category){const tag=element('span','tag category-color',category);tag.dataset.category=category;return tag;}
function groupCard(type,item,subtitle,fill){const card=element('details','admin-item admin-group');card.open=expanded[type].has(item.id);const summary=element('summary','admin-summary');const top=element('div','admin-summary-top');top.append(categoryTag(item.category),info('#'+item.id),info(subtitle));summary.append(top,cardTitle(item.title));const content=element('div','admin-detail');card.append(summary,content);let loaded=false;function populate(){if(!loaded&&card.open){loaded=true;fill(content);}}card.addEventListener('toggle',()=>{if(card.open)expanded[type].add(item.id);else expanded[type].delete(item.id);populate();});populate();return card;}
function linkTo(type,id){focusId[type]=id;pages[type]=1;expanded[type].clear();expanded[type].add(id);const prefix=type==='posts'?'post':'comment';$('#'+prefix+'Search').value='';showTab(type);}
function queryFor(type){const prefix=type==='posts'?'post':'comment';$('#'+prefix+'Clear').hidden=!focusId[type];return new URLSearchParams({page:pages[type],q:$('#'+prefix+'Search').value,sort:$('#'+prefix+'Sort').value,...(focusId[type]?{post_id:focusId[type]}:{})});}
function pageInfo(type,data){const prefix=type==='posts'?'post':'comment';$('#'+prefix+'Page').textContent=`第 ${data.page} / ${data.pages} 頁 · 共 ${data.total} 篇文章`;$('#'+prefix+'Prev').disabled=pages[type]===1;$('#'+prefix+'Next').disabled=pages[type]>=data.pages;}
async function loadPosts(){const target=$('#adminPosts'),version=++requestVersion.posts;target.replaceChildren(info('載入文章中...'));try{const data=await api('/api/admin/posts?'+queryFor('posts'));if(version!==requestVersion.posts)return;target.replaceChildren();pageInfo('posts',data);if(!data.posts.length&&pages.posts>1){pages.posts--;return loadPosts();}if(!data.posts.length)target.append(info('沒有符合的文章。'));
for(const item of data.posts){const status=item.withdrawn_at?'作者已撤下':item.hidden?'已隱藏':'公開中';target.append(groupCard('posts',item,`${status} · ${twDate(item.created_at)} · ${item.comments_count} 則留言 · ${item.photos_count} 張照片`,content=>{if(item.edited_at)content.append(info('修改於 '+twDate(item.edited_at)));content.append(element('p','admin-body',item.body));const actions=itemActions('post',item,loadPosts);actions.prepend(control('查看留言',()=>linkTo('comments',item.id)),control('管理照片',()=>loadPostImages(item.id,content)),control('編輯紀錄',()=>loadRevisions(item.id,content)));content.append(actions);}));}}
catch(e){if(version===requestVersion.posts)renderError(target,e);}}
async function fillComments(item,content){const actions=element('div','admin-item-actions');actions.append(control('返回文章',()=>linkTo('posts',item.id)));const list=element('div','admin-list');const more=control('載入更多留言',()=>next());content.append(actions,list,more);let page=1;async function next(){more.disabled=true;try{const data=await api('/api/admin/comments?'+new URLSearchParams({post_id:item.id,page}));for(const c of data.comments){const card=element('div','admin-comment');card.append(info(`#${c.id} · ${c.hidden?'已隱藏':'公開中'} · ${twDate(c.created_at)}`),element('p','admin-body',c.body),itemActions('comment',c,loadComments));list.append(card);}more.hidden=page>=data.pages;page++;}catch(e){list.append(info(e.message));}finally{more.disabled=false;}}await next();}
async function loadComments(){const target=$('#adminComments'),version=++requestVersion.comments;target.replaceChildren(info('載入留言中...'));try{const data=await api('/api/admin/comment-groups?'+queryFor('comments'));if(version!==requestVersion.comments)return;target.replaceChildren();pageInfo('comments',data);if(!data.groups.length&&pages.comments>1){pages.comments--;return loadComments();}if(!data.groups.length){target.append(info('沒有符合的留言。'));if(focusId.comments)target.append(control('返回文章',()=>linkTo('posts',focusId.comments)));}for(const item of data.groups)target.append(groupCard('comments',item,`${item.comments_count} 則留言`,content=>fillComments(item,content)));}catch(e){if(version===requestVersion.comments)renderError(target,e);}}
async function loadReports(){const target=$('#reports');target.replaceChildren(info('載入檢舉中...'));try{
 const {reports}=await api('/api/admin/reports');target.replaceChildren();if(!reports.length)target.append(info('目前沒有待處理檢舉。'));
 for(const r of reports){const card=element('article','admin-item');card.append(cardTitle(`檢舉 #${r.id} · ${r.target_type==='post'?'文章':'留言'} #${r.target_id}`),info(twDate(r.created_at)),element('p','admin-body',r.target_excerpt||'（內容不存在）'),info('檢舉原因：'+r.reason));const actions=element('div','admin-item-actions');
 actions.append(control('隱藏內容',()=>runAction('確定隱藏這個內容？',()=>api('/api/admin/hide',{method:'POST',body:JSON.stringify({type:r.target_type,id:r.target_id})}),loadReports)),control('標記已處理',()=>runAction('將此檢舉標記為已處理？',()=>api('/api/admin/resolve',{method:'POST',body:JSON.stringify({id:r.id})}),loadReports)));
 card.append(actions);target.append(card);}
}catch(e){renderError(target,e);}}
const loaders={announcements:loadAnnouncements,site:loadSite,posts:loadPosts,comments:loadComments,reports:loadReports};
function showTab(tab){activeTab=tab;for(const button of document.querySelectorAll('[data-tab]')){const selected=button.dataset.tab===tab;button.classList.toggle('selected',selected);button.setAttribute('aria-selected',String(selected));}for(const panel of document.querySelectorAll('.admin-panel'))panel.hidden=panel.id!==`panel-${tab}`;loaders[tab]();}
for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>showTab(button.dataset.tab));
for(const button of document.querySelectorAll('[data-refresh]'))button.addEventListener('click',()=>loaders[button.dataset.refresh]());
$('#postPrev').addEventListener('click',()=>{if(pages.posts>1){pages.posts--;loadPosts();}});
$('#postNext').addEventListener('click',()=>{pages.posts++;loadPosts();});
$('#commentPrev').addEventListener('click',()=>{if(pages.comments>1){pages.comments--;loadComments();}});
$('#commentNext').addEventListener('click',()=>{pages.comments++;loadComments();});
showTab('site');

let announcementId=null;
function resetAnnouncement(){announcementId=null;$('#announcementForm').reset();}
$('#announcementCancel').addEventListener('click',resetAnnouncement);
$('#announcementForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button[type=submit]');b.disabled=true;try{await api('/api/admin/announcements'+(announcementId?'/'+announcementId:''),{method:announcementId?'PUT':'POST',body:JSON.stringify({title:$('#announcementTitle').value,body:$('#announcementBody').value,pinned:$('#announcementPinned').checked})});resetAnnouncement();notify('公告已儲存');await loadAnnouncements();}catch(err){notify(err.message);}finally{b.disabled=false;}});
async function loadAnnouncements(){const target=$('#adminAnnouncements');try{const {announcements}=await api('/api/admin/announcements');target.replaceChildren();if(!announcements.length)target.append(info('目前沒有公告。'));for(const a of announcements){const card=element('article','admin-item');card.append(cardTitle((a.pinned?'📌 ':'')+a.title),element('p','admin-body',a.body),control('編輯',()=>{announcementId=a.id;$('#announcementTitle').value=a.title;$('#announcementBody').value=a.body;$('#announcementPinned').checked=!!a.pinned;$('#announcementTitle').focus();}),control('刪除',()=>runAction('確定刪除此公告？',()=>api('/api/admin/announcements/'+a.id,{method:'DELETE'}),()=>{resetAnnouncement();return loadAnnouncements();}),'danger-btn'));target.append(card);}}catch(e){renderError(target,e);}}
async function loadPostImages(id,card){let grid=card.querySelector('.admin-images');if(!grid){grid=element('div','admin-images photo-grid');card.append(grid);}try{const {images}=await api('/api/admin/posts/'+id+'/images');grid.replaceChildren();if(!images.length)grid.append(info('沒有附加照片。'));for(const imageId of images){const item=element('div','preview-item'),img=element('img','post-photo');img.src='/api/admin/images/'+imageId;img.alt='文章附加照片';item.append(img,control('移除照片',()=>runAction('確定永久移除此照片？',()=>api('/api/admin/images/'+imageId,{method:'DELETE'}),()=>loadPostImages(id,card)),'danger-btn'));grid.append(item);}}catch(e){renderError(grid,e);}}

async function loadRevisions(id,card){let panel=card.querySelector('.revision-panel');if(!panel){panel=element('div','revision-panel');card.append(panel);}try{const data=await api('/api/admin/posts/'+id+'/revisions');panel.replaceChildren();if(data.withdrawn_at)panel.append(info('作者撤下時間：'+twDate(data.withdrawn_at)));if(!data.revisions.length)panel.append(info('沒有編輯紀錄。'));for(const r of data.revisions){const item=element('div','admin-item');item.append(info('修改時間：'+twDate(r.changed_at)),cardTitle(r.category+' · '+r.title),element('p','admin-body',r.body),info('修改前照片數：'+JSON.parse(r.image_ids).length));panel.append(item);}}catch(e){renderError(panel,e);}}

for(const [type,prefix] of [['posts','post'],['comments','comment']]){let timer;const reload=()=>{pages[type]=1;loaders[type]();};$('#'+prefix+'Search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(reload,250);});$('#'+prefix+'Sort').addEventListener('change',reload);$('#'+prefix+'Clear').addEventListener('click',()=>{focusId[type]=0;$('#'+prefix+'Search').value='';expanded[type].clear();reload();});}
