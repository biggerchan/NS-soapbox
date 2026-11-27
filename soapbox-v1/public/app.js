const $ = (selector) => document.querySelector(selector);
const state={page:1,pages:1,posts:[],activeId:null,report:null};
const categories=['公司制度','工作環境','福利建議','心情分享','其他'];
const emojis=['👍','😂','😡'];
const emojiNames=['讚','大笑','怒'];
let visitorId=crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(18)),x=>x.toString(16).padStart(2,'0')).join('');try{visitorId=localStorage.getItem('nicebox-visitor')||visitorId;localStorage.setItem('nicebox-visitor',visitorId);}catch{}
let selectedImages=[];let processing=false;
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3500);}
function date(s){return new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short'}).format(new Date(s));}
async function api(url,options={}){const res=await fetch(url,{...options,headers:{'Content-Type':'application/json','X-Visitor-Id':visitorId,...(options.headers||{})}});let data;try{data=await res.json();}catch{throw Error('伺服器回應異常');}if(!res.ok)throw Error(data.error||'操作失敗');return data;}
function button(text,callback,css='ghost'){const b=el('button',css,text);b.type='button';b.addEventListener('click',callback);return b;}
function openDialog(id){document.getElementById(id).showModal();}
for(const close of document.querySelectorAll('[data-close]'))close.addEventListener('click',()=>document.getElementById(close.dataset.close).close());
for(const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click',(e)=>{if(e.target===dialog)dialog.close();});
function renderPost(post){
 const card=el('article','post');const head=el('div','post-head');head.append(el('span','tag',post.category),el('span','meta','匿名同事 · '+date(post.created_at)));
 const title=el('h3','',post.title),body=el('p','',post.body.length>175?post.body.slice(0,175)+'…':post.body);
 const footer=el('div','post-footer'),actions=el('div','post-actions');
 const reactions=el('div','reaction-bar');renderReactions(reactions,post);
 actions.append(button('💬 留言 '+post.comments_count,()=>openThread(post)));
 footer.append(actions,button('檢舉',()=>report('post',post.id),'link-btn'));
 card.append(head,title,body,photoGrid(post.images),reactions,footer);return card;
}
async function load(){const target=$('#posts');target.replaceChildren(el('p','empty','正在讀取意見...'));const query=new URLSearchParams({page:state.page,sort:$('#sort').value,category:$('#category').value});try{const data=await api('/api/posts?'+query);state.posts=data.posts;state.pages=data.pages;target.replaceChildren(...(data.posts.length?data.posts.map(renderPost):[el('p','empty','目前還沒有文章，成為第一位發聲的人。')]));$('#pageLabel').textContent=`第 ${state.page} / ${state.pages} 頁 · 共 ${data.total} 篇`;$('#prev').disabled=state.page<=1;$('#next').disabled=state.page>=state.pages;}catch(e){target.replaceChildren(el('p','empty','讀取失敗：'+e.message));}}
$('#composeBtn').addEventListener('click',()=>openDialog('composeDialog'));
for(const link of document.querySelectorAll('[data-sort-link]'))link.addEventListener('click',()=>{$('#sort').value=link.dataset.sortLink;state.page=1;load();});
$('#category').addEventListener('change',()=>{state.page=1;load();});$('#sort').addEventListener('change',()=>{state.page=1;load();});
$('#prev').addEventListener('click',()=>{if(state.page>1){state.page--;load();}});$('#next').addEventListener('click',()=>{if(state.page<state.pages){state.page++;load();}});
$('#composeForm').addEventListener('submit',async(e)=>{e.preventDefault();if(processing)return toast('照片處理中，請稍候。');const submit=$('#composeForm button[type=submit]');if(submit.disabled)return;submit.disabled=true;try{await api('/api/posts',{method:'POST',body:JSON.stringify({category:$('#newCategory').value,title:$('#newTitle').value,body:$('#newBody').value,images:selectedImages})});$('#composeForm').reset();selectedImages=[];previewImages();$('#composeDialog').close();state.page=1;$('#sort').value='new';$('#category').value='';await load();toast('意見已匿名發布。');}catch(err){toast(err.message);}finally{submit.disabled=false;}});
async function openThread(post){state.activeId=post.id;const content=$('#threadPost');content.replaceChildren(el('div','thread-meta',post.category+' · '+date(post.created_at)),el('div','thread-title',post.title),el('div','thread-body',post.body),photoGrid(post.images));$('#commentBody').value='';openDialog('threadDialog');await loadComments();}
async function loadComments(){const target=$('#comments');target.replaceChildren(el('p','fine','載入留言中...'));try{const data=await api(`/api/posts/${state.activeId}/comments`);target.replaceChildren();if(!data.comments.length)target.append(el('p','fine','尚無留言，歡迎開始討論。'));for(const c of data.comments){const card=el('div','comment');const h=el('div','post-head');h.append(el('span','meta','匿名留言 · '+date(c.created_at)),button('檢舉',()=>report('comment',c.id),'link-btn'));card.append(h,el('p','',c.body));target.append(card);}}catch(e){target.replaceChildren(el('p','fine',e.message));}}
$('#commentForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await api(`/api/posts/${state.activeId}/comments`,{method:'POST',body:JSON.stringify({body:$('#commentBody').value})});$('#commentBody').value='';await loadComments();await load();toast('匿名留言已發布。');}catch(err){toast(err.message);}});
function report(type,id){state.report={type,id};openDialog('reportDialog');}
$('#reportForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await api('/api/reports',{method:'POST',body:JSON.stringify({...state.report,reason:$('#reportReason').value})});$('#reportDialog').close();$('#reportForm').reset();toast('已收到檢舉，謝謝你的回報。');}catch(err){toast(err.message);}});
loadSiteText();
load();
loadAnnouncements();
async function loadSiteText(){
 try {
  const data=await api('/api/site-settings');
  for(const node of document.querySelectorAll('[data-site-key]')){
   const value=data.settings?.[node.dataset.siteKey];
   if(typeof value==='string')node.textContent=value;
  }
  document.title='NICE BOX｜VOICE OUT LOUD';
 }catch(e){console.warn('文案讀取失敗，保留預設文案',e);}
}

function renderReactions(target,post){target.replaceChildren();emojis.forEach((emoji,i)=>{const b=button(emoji+' '+(post.reactions?.[emoji]||0),async()=>{for(const x of target.querySelectorAll('button'))x.disabled=true;try{const result=await api(`/api/posts/${post.id}/reaction`,{method:'POST',body:JSON.stringify({emoji:post.myReaction===emoji?null:emoji})});Object.assign(post,result);renderReactions(target,post);}catch(e){toast(e.message);for(const x of target.querySelectorAll('button'))x.disabled=false;}},'reaction-button');b.setAttribute('aria-label',emojiNames[i]+' '+(post.reactions?.[emoji]||0));b.setAttribute('aria-pressed',String(post.myReaction===emoji));target.append(b);});}
function photoGrid(ids=[]){const grid=el('div','photo-grid');for(const id of ids){const img=el('img','post-photo');img.src='/api/images/'+id;img.alt='文章附加照片';img.loading='lazy';const b=button('',()=>{$('#largePhoto').src=img.src;openDialog('photoDialog');},'photo-button');b.setAttribute('aria-label','放大照片');b.append(img);grid.append(b);}return grid;}
function previewImages(){const grid=$('#imagePreview');grid.replaceChildren();selectedImages.forEach((src,i)=>{const item=el('div','preview-item'),img=el('img','post-photo');img.src=src;img.alt='待上傳照片';item.append(img,button('移除',()=>{selectedImages.splice(i,1);previewImages();}));grid.append(item);});}
async function compress(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10000000)throw Error('請選擇 10 MB 以下的 JPG、PNG 或 WebP。');const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',0.82);if(data.length>2800000)throw Error('照片壓縮後仍太大。');return data;}finally{bitmap.close();}}
$('#newImages').addEventListener('change',async e=>{const files=[...e.target.files];e.target.value='';if(processing)return;if(selectedImages.length+files.length>4)return toast('每篇最多四張照片。');processing=true;try{for(const file of files){selectedImages.push(await compress(file));previewImages();}}catch(err){toast(err.message);}finally{processing=false;}});
async function loadAnnouncements(){try{const {announcements}=await api('/api/announcements');if(!announcements.length)return;$('#announcements').hidden=false;let expanded=false;const draw=()=>{$('#announcementList').replaceChildren(...announcements.slice(0,expanded?100:3).map(a=>{const item=el('details','announcement-item');item.append(el('summary','',(a.pinned?'📌 ':'')+a.title),el('p','announcement-body',a.body),el('small','fine',date(a.created_at)));return item;}));$('#announcementMore').hidden=announcements.length<=3;$('#announcementMore').textContent=expanded?'收合公告':'查看全部公告';};$('#announcementMore').addEventListener('click',()=>{expanded=!expanded;draw();});draw();}catch(e){console.warn(e);}}
