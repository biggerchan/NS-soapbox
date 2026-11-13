const $ = (selector) => document.querySelector(selector);
const state={page:1,pages:1,posts:[],activeId:null,report:null};
const categories=['公司制度','工作環境','福利建議','心情分享','其他'];
const likedKey='soapbox-liked-posts';
let liked; try{liked=new Set(JSON.parse(localStorage.getItem(likedKey)||'[]'));}catch{liked=new Set();}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3500);}
function date(s){return new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short'}).format(new Date(s));}
async function api(url,options={}){const res=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});let data;try{data=await res.json();}catch{throw Error('伺服器回應異常');}if(!res.ok)throw Error(data.error||'操作失敗');return data;}
function button(text,callback,css='ghost'){const b=el('button',css,text);b.type='button';b.addEventListener('click',callback);return b;}
function openDialog(id){document.getElementById(id).showModal();}
for(const close of document.querySelectorAll('[data-close]'))close.addEventListener('click',()=>document.getElementById(close.dataset.close).close());
for(const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click',(e)=>{if(e.target===dialog)dialog.close();});
function renderPost(post){
 const card=el('article','post');const head=el('div','post-head');head.append(el('span','tag',post.category),el('span','meta','匿名同事 · '+date(post.created_at)));
 const title=el('h3','',post.title),body=el('p','',post.body.length>175?post.body.slice(0,175)+'…':post.body);
 const footer=el('div','post-footer'),actions=el('div','post-actions');
 const like=button((liked.has(post.id)?'✓ 已支持':'♡ 支持')+' '+post.likes,async()=>{if(liked.has(post.id)){toast('你已在此瀏覽器支持過這篇文章。');return;}try{await api(`/api/posts/${post.id}/like`,{method:'POST'});liked.add(post.id);localStorage.setItem(likedKey,JSON.stringify([...liked]));post.likes++;like.textContent=`✓ 已支持 ${post.likes}`;}catch(e){toast(e.message);}});
 actions.append(like,button('💬 留言 '+post.comments_count,()=>openThread(post)));
 footer.append(actions,button('檢舉',()=>report('post',post.id),'link-btn'));
 card.append(head,title,body,footer);return card;
}
async function load(){const target=$('#posts');target.replaceChildren(el('p','empty','正在讀取意見...'));const query=new URLSearchParams({page:state.page,sort:$('#sort').value,category:$('#category').value});try{const data=await api('/api/posts?'+query);state.posts=data.posts;state.pages=data.pages;target.replaceChildren(...(data.posts.length?data.posts.map(renderPost):[el('p','empty','目前還沒有文章，成為第一位發聲的人。')]));$('#pageLabel').textContent=`第 ${state.page} / ${state.pages} 頁 · 共 ${data.total} 篇`;$('#prev').disabled=state.page<=1;$('#next').disabled=state.page>=state.pages;}catch(e){target.replaceChildren(el('p','empty','讀取失敗：'+e.message));}}
$('#composeBtn').addEventListener('click',()=>openDialog('composeDialog'));
$('#category').addEventListener('change',()=>{state.page=1;load();});$('#sort').addEventListener('change',()=>{state.page=1;load();});
$('#prev').addEventListener('click',()=>{if(state.page>1){state.page--;load();}});$('#next').addEventListener('click',()=>{if(state.page<state.pages){state.page++;load();}});
$('#composeForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await api('/api/posts',{method:'POST',body:JSON.stringify({category:$('#newCategory').value,title:$('#newTitle').value,body:$('#newBody').value})});$('#composeForm').reset();$('#composeDialog').close();state.page=1;$('#sort').value='new';$('#category').value='';await load();toast('意見已匿名發布。');}catch(err){toast(err.message);}});
async function openThread(post){state.activeId=post.id;const content=$('#threadPost');content.replaceChildren(el('div','thread-meta',post.category+' · '+date(post.created_at)),el('div','thread-title',post.title),el('div','thread-body',post.body));$('#commentBody').value='';openDialog('threadDialog');await loadComments();}
async function loadComments(){const target=$('#comments');target.replaceChildren(el('p','fine','載入留言中...'));try{const data=await api(`/api/posts/${state.activeId}/comments`);target.replaceChildren();if(!data.comments.length)target.append(el('p','fine','尚無留言，歡迎開始討論。'));for(const c of data.comments){const card=el('div','comment');const h=el('div','post-head');h.append(el('span','meta','匿名留言 · '+date(c.created_at)),button('檢舉',()=>report('comment',c.id),'link-btn'));card.append(h,el('p','',c.body));target.append(card);}}catch(e){target.replaceChildren(el('p','fine',e.message));}}
$('#commentForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await api(`/api/posts/${state.activeId}/comments`,{method:'POST',body:JSON.stringify({body:$('#commentBody').value})});$('#commentBody').value='';await loadComments();await load();toast('匿名留言已發布。');}catch(err){toast(err.message);}});
function report(type,id){state.report={type,id};openDialog('reportDialog');}
$('#reportForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await api('/api/reports',{method:'POST',body:JSON.stringify({...state.report,reason:$('#reportReason').value})});$('#reportDialog').close();$('#reportForm').reset();toast('已收到檢舉，謝謝你的回報。');}catch(err){toast(err.message);}});
loadSiteText();
load();
async function loadSiteText(){
 try {
  const data=await api('/api/site-settings');
  for(const node of document.querySelectorAll('[data-site-key]')){
   const value=data.settings?.[node.dataset.siteKey];
   if(typeof value==='string')node.textContent=value;
  }
  if(data.settings?.brand)document.title=data.settings.brand+'｜匿名意見';
 }catch(e){console.warn('文案讀取失敗，保留預設文案',e);}
}
