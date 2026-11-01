import { firebaseConfig } from "./firebase-config.js";
// Firebase SDK is loaded on demand so the app still opens (local mode) when it can't be reached.
const FB = "https://www.gstatic.com/firebasejs/10.14.1/";
let initializeApp, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit, writeBatch;
async function loadFirebase(){
  const [a,u,f]=await Promise.all([import(FB+"firebase-app.js"),import(FB+"firebase-auth.js"),import(FB+"firebase-firestore.js")]);
  ({initializeApp}=a);
  ({getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signInWithRedirect,getRedirectResult,signOut}=u);
  ({initializeFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,setDoc,deleteDoc,onSnapshot,query,orderBy,limit,writeBatch}=f);
}

const configured = !!(firebaseConfig && firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("YOUR"));
const PLAN = {
  A1:{label:"胸背", sub:"重 barbell", ex:[
    {k:"bench",t:"2分鐘",n:"Barbell bench press",s:4,r:"6-8",u:"kg",ref:"60kg × 2–6"},
    {k:"latpd",t:"90秒",n:"Lat pull down",s:4,r:"8-10",u:"kg",ref:"45kg"},
    {k:"incdb",t:"90秒",n:"Incline dumbbell press",s:3,r:"8-10",u:"kg",ref:"14kg"},
    {k:"lowrow",t:"90秒",n:"Low row（重）",s:3,r:"8-10",u:"kg",ref:"45kg × 6"},
    {k:"cablex",t:"60秒",n:"Cable cross over",s:3,r:"12-15",u:"lb",ref:"25lb"},
    {k:"straightpd",t:"60秒",n:"直臂下拉",s:3,r:"12-15",u:"kg",ref:"45kg"},
    {k:"curl",t:"60秒",n:"Bicep curl",s:2,r:"12",u:"kg",ref:"17.5kg"},
    {k:"rope",t:"60秒",n:"Triceps pull down rope",s:2,r:"12",u:"lb",ref:"60lb"}]},
  B1:{label:"腳膊手", sub:"Squat 日", ex:[
    {k:"squat",t:"2分鐘",n:"Squat",s:4,r:"6-8",u:"kg",ref:"60kg × 6"},
    {k:"legext",t:"60秒",n:"Leg extension",s:3,r:"12",u:"lb",ref:"160lb"},
    {k:"legcurl",t:"60秒",n:"Prone leg curl",s:4,r:"12",u:"lb",ref:"41lb"},
    {k:"shpress",t:"90秒",n:"Shoulder press（坐機）",s:3,r:"8-10",u:"kg",ref:"29kg"},
    {k:"latraise",t:"60秒",n:"飛膊",s:4,r:"15",u:"kg",ref:"6kg × 20"},
    {k:"facepull",t:"60秒",n:"Face pull",s:2,r:"15",u:"lb",ref:"100lb"},
    {k:"curl",t:"60秒",n:"Bicep curl",s:2,r:"12",u:"kg",ref:"17.5kg"},
    {k:"rope",t:"60秒",n:"Triceps pull down rope",s:2,r:"12",u:"lb",ref:"60lb"},
    {k:"deadbug",t:"30秒",n:"Dead bug",s:2,r:"10",bw:"下"},
    {k:"plank",t:"30秒",n:"Plank",s:2,r:"30",bw:"秒"}]},
  A2:{label:"胸背", sub:"啞鈴／機", ex:[
    {k:"incbb",t:"2分鐘",n:"Barbell incline press",s:4,r:"6-8",u:"kg",ref:"40kg × 3–8"},
    {k:"closepd",t:"90秒",n:"Close neutral grip pull down",s:3,r:"10",u:"kg",ref:"43kg"},
    {k:"dbpress",t:"90秒",n:"Dumbbell press",s:3,r:"8-10",u:"kg",ref:"16kg"},
    {k:"divrow",t:"90秒",n:"Diving seated row",s:3,r:"10",u:"kg",ref:"36kg"},
    {k:"fly",t:"60秒",n:"Butterfly chest fly",s:3,r:"12",u:"kg",ref:"5kg"},
    {k:"curl",t:"60秒",n:"Bicep curl",s:2,r:"12",u:"kg",ref:"17.5kg"},
    {k:"rope",t:"60秒",n:"Triceps pull down rope",s:2,r:"12",u:"lb",ref:"60lb"}]},
  B2:{label:"腳膊手", sub:"Leg press 日", ex:[
    {k:"legpress",t:"2分鐘",n:"Leg press（重）",s:4,r:"8-10",u:"kg",ref:"160kg"},
    {k:"hipthrust",t:"90秒",n:"Hip thrust",s:3,r:"10",u:"kg"},
    {k:"legcurl",t:"60秒",n:"Prone leg curl",s:4,r:"12",u:"lb",ref:"41lb"},
    {k:"dbsh",t:"90秒",n:"推膊 dumbbell（坐）",s:3,r:"10",u:"kg",ref:"20kg × 6"},
    {k:"reardelt",t:"60秒",n:"Butterfly 後膊",s:2,r:"15",u:"kg",ref:"25kg"},
    {k:"cablelat",t:"60秒",n:"側膊 cable",s:3,r:"15",u:"lb",ref:"15lb"},
    {k:"singlecurl",t:"60秒",n:"單邊 dumbbell curl",s:2,r:"12",u:"kg",ref:"10kg"},
    {k:"tripress",t:"60秒",n:"Tricep press",s:2,r:"12",u:"lb",ref:"90lb"},
    {k:"birddog",t:"30秒",n:"Bird dog",s:2,r:"10",bw:"下"},
    {k:"sideplank",t:"30秒",n:"側 plank",s:2,r:"20",bw:"秒"}]}
};
const DAYS = ["A1","B1","A2","B2"];
const $ = id => document.getElementById(id);

function today(){const d=new Date();const p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())}
function lsGet(k,f){try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch(e){return f}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
// For records: a failed write must not look like a save.
function lsSave(v){try{localStorage.setItem("wlog.sessions",JSON.stringify(v))}catch(e){throw {code:"quota_exceeded"}}}

const S = {day:lsGet("wlog.day","A1"), date:today(), sets:{}, units:{}, curId:null, sessions:[], dirty:false};

/* ---------- storage: Firebase Firestore when signed in, this device otherwise ---------- */
const store = {
  mode:"local", db:null, uid:null, cb:null, unsub:null,
  emitLocal(){ const all=lsGet("wlog.sessions",{}); this.cb(Object.entries(all).map(([id,v])=>({id,...v}))); },
  async init(cb){
    this.cb=cb;
    this.emitLocal();
    if(!configured){ showNote("未設定 Firebase：記錄只會存喺呢部機。設定方法見 README。"); setStatus(""); renderAccount(null); return; }
    try{ await loadFirebase(); }
    catch(e){ showNote("連唔到 Firebase：記錄暫時只存喺呢部機。"); setStatus(""); renderAccount(null); return; }
    const app=initializeApp(firebaseConfig);
    this.db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
    const auth=getAuth(app); this.auth=auth;
    getRedirectResult(auth).catch(()=>{});
    onAuthStateChanged(auth,user=>{
      if(this.unsub){this.unsub();this.unsub=null;}
      renderAccount(user);
      if(!user){ this.mode="local"; this.uid=null; showNote("未登入：記錄暫時只存喺呢部機。登入後會同步到雲端。"); this.emitLocal(); setStatus(""); return; }
      this.mode="db"; this.uid=user.uid; hideNote();
      const q=query(collection(this.db,"users",user.uid,"sessions"),orderBy("date","desc"),limit(500));
      const timer=setTimeout(()=>showNote("暫時連唔到雲端，顯示嘅可能唔係最新。"),10000);
      this.unsub=onSnapshot(q,{includeMetadataChanges:true},snap=>{
        if(!snap.metadata.fromCache){clearTimeout(timer);hideNote();}
        cb(snap.docs.map(d=>({id:d.id,...d.data()})));
        if(!S.dirty) setStatus("");
      },err=>{clearTimeout(timer);showNote("未能讀取雲端記錄（"+err.code+"）。");});
      this.uploadLocal();
    });
  },
  async signIn(){
    const p=new GoogleAuthProvider();
    try{ await signInWithPopup(this.auth,p); }
    catch(e){ if(e&&(e.code==="auth/popup-blocked"||e.code==="auth/operation-not-supported-in-this-environment")) await signInWithRedirect(this.auth,p); else showNote("登入失敗（"+(e&&e.code||"unknown")+"）。"); }
  },
  async logout(){ await signOut(this.auth); },
  ref(id){ return doc(this.db,"users",this.uid,"sessions",id); },
  async save(id,body){
    if(this.mode==="db") return setDoc(this.ref(id),body);
    const all=lsGet("wlog.sessions",{}); all[id]=body; lsSave(all); this.emitLocal();
  },
  async remove(id){
    if(this.mode==="db") return deleteDoc(this.ref(id));
    const all=lsGet("wlog.sessions",{}); delete all[id]; lsSave(all); this.emitLocal();
  },
  async saveMany(list){
    if(this.mode!=="db"){ const all=lsGet("wlog.sessions",{}); list.forEach(x=>{const {id,...b}=x; all[id]=b;}); lsSave(all); this.emitLocal(); return; }
    for(let i=0;i<list.length;i+=400){
      const b=writeBatch(this.db);
      list.slice(i,i+400).forEach(x=>{const {id,...body}=x; b.set(this.ref(id),body);});
      await b.commit();
    }
  },
  async uploadLocal(){
    // records made before signing in move to the cloud once
    const all=lsGet("wlog.sessions",{}); const list=Object.entries(all).map(([id,v])=>({id,...v}));
    if(!list.length) return;
    try{ await this.saveMany(list); lsSet("wlog.sessions",{}); }catch(e){}
  }
};

function renderAccount(user){
  const a=$("account"); a.innerHTML="";
  if(!configured){ a.hidden=true; return; }
  a.hidden=false;
  const t=document.createElement("span"); t.className="who";
  const b=document.createElement("button"); b.type="button"; b.className="btn";
  if(user){ t.textContent="已同步 · "+(user.email||"已登入"); b.textContent="登出"; b.onclick=()=>store.logout(); }
  else { t.textContent="未登入"; b.textContent="用 Google 登入"; b.className="btn primary"; b.onclick=()=>store.signIn(); }
  a.append(t,b);
}

/* ---------- backup: export / import JSON ---------- */
function exportJson(){
  const data=S.sessions.map(({id,day,date,sets,units,updated})=>({id,day,date,sets,units,updated}));
  const blob=new Blob([JSON.stringify(data,null,1)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="gym-log-"+today()+".json";
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}
async function importJson(file){
  try{
    let data=JSON.parse(await file.text());
    if(!Array.isArray(data)) data=Object.entries(data).map(([id,v])=>({id,...v}));
    const list=cleanAll(data).filter(x=>Object.values(x.sets).some(a=>a.some(v=>v.w!==""||v.r!=="")))
      .map(x=>({...x,updated:x.updated||new Date().toISOString()}));
    if(!list.length){ showNote("檔案入面搵唔到訓練記錄。"); return; }
    await store.saveMany(list);
    setStatus("已匯入 "+list.length+" 次記錄 ✓",true);
  }catch(e){ showNote(e&&e.code==="quota_exceeded"?"匯入失敗：儲存空間已滿。":e instanceof SyntaxError?"匯入失敗：檔案唔係有效嘅 JSON。":"匯入失敗（"+(e&&e.code||"未知錯誤")+"）。"); }
}

function showNote(t){$("note").textContent=t;$("note").hidden=false}
function hideNote(){$("note").hidden=true}
function setStatus(t,ok){const s=$("status");s.textContent=t;s.className="status"+(ok?" ok":"")}

/* ---------- helpers ---------- */
// Clean one record from storage or a file; returns null when it can't be used.
const ID_RE=/^[A-Za-z0-9_\-]{1,80}$/, DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const num=v=>String(v??"").replace(/[^0-9.]/g,"").slice(0,8);
function clean(x){
  if(!x||typeof x!=="object"||!PLAN[x.day]||!DATE_RE.test(String(x.date))||!x.sets||typeof x.sets!=="object") return null;
  const id=ID_RE.test(String(x.id||""))?String(x.id):x.date+"_"+x.day;
  const sets={};
  for(const [k,a] of Object.entries(x.sets)){
    if(!Array.isArray(a)) continue;
    sets[k]=a.slice(0,20).map(v=>v&&typeof v==="object"?{w:num(v.w),r:num(v.r)}:{w:"",r:""});
  }
  const units={};
  if(x.units&&typeof x.units==="object") for(const [k,u] of Object.entries(x.units)) if(u==="kg"||u==="lb") units[k]=u;
  const updated=typeof x.updated==="string"?x.updated:"";
  return {id,day:x.day,date:x.date,sets,units,updated};
}
const cleanAll=list=>list.map(clean).filter(Boolean);

// The record on screen. null = a blank form that is not saved yet; it gets an id on its first save.
function newId(date,day){ const base=date+"_"+day; let id=base, n=2; while(S.sessions.some(x=>x.id===id)) id=base+"_"+(n++); return id; }
function findFor(date,day){ return S.sessions.filter(x=>x.date===date&&x.day===day).sort((a,b)=>(b.updated||"").localeCompare(a.updated||""))[0]||null; }
function topRep(r){const p=String(r).split("-");return Number(p[p.length-1])}
// Order key: date first, then save time (so two sessions on one day keep their order).
const key=x=>(x.date||"")+"|"+(x.updated||"");
function lastFor(k){
  // most recent session (any day) before the one on screen that logged this exercise
  const cur=S.sessions.find(x=>x.id===S.curId);
  const here=cur?key(cur):S.date+"|~";   // a new, unsaved form counts as the latest of its date
  const list=S.sessions.filter(x=>x.id!==S.curId && key(x)<here && x.sets[k] && x.sets[k].some(v=>v.w!==""||v.r!==""))
    .sort((a,b)=>key(b).localeCompare(key(a)));
  return list[0]||null;
}
function hasData(){return Object.values(S.sets).some(a=>a.some(v=>v&&((v.w??"")!==""||(v.r??"")!=="")))}

/* ---------- render ---------- */
function renderTabs(){
  $("tabs").innerHTML="";
  DAYS.forEach(d=>{
    const b=document.createElement("button");
    b.className="tab";b.type="button";b.dataset.d=d;b.setAttribute("role","tab");
    b.setAttribute("aria-selected",d===S.day?"true":"false");
    b.innerHTML="<b>"+d+"</b><span>"+PLAN[d].label+"</span>";
    b.onclick=()=>{ if(d===S.day) return; flush(); S.day=d; lsSet("wlog.day",d); openDate(S.date); };
    $("tabs").appendChild(b);
  });
  document.body.dataset.day=S.day;
}

function renderList(){
  const L=$("list"); L.innerHTML="";
  const ex=PLAN[S.day].ex; let i=0;
  while(i<ex.length){
    if(ex[i].ss){
      const g=document.createElement("div");g.className="ss";
      const t=document.createElement("div");t.className="ss-tag";t.textContent="超級組 · 兩個做完先休";g.appendChild(t);
      const tag=ex[i].ss;
      while(i<ex.length && ex[i].ss===tag){g.appendChild(card(ex[i]));i++;}
      L.appendChild(g);
    } else { L.appendChild(card(ex[i])); i++; }
  }
}

function card(e){
  const c=document.createElement("div");c.className="ex";
  const last=lastFor(e.k);
  const lastSets=last?last.sets[e.k]:null;
  const lastUnit=last&&last.units&&last.units[e.k];
  const unit=S.units[e.k]||lastUnit||e.u||"";
  const n=Math.max(e.s,(S.sets[e.k]||[]).length);
  const head=document.createElement("div");head.className="ex-head";
  head.innerHTML='<div class="ex-name"></div><div class="ex-target">'+e.s+' × '+e.r.replace("-","–")+(e.bw==="秒"?"秒":"")+'</div>';
  head.querySelector(".ex-name").textContent=e.n;
  c.appendChild(head);

  const meta=document.createElement("div");meta.className="meta";
  if(e.t){const rt=document.createElement("span");rt.className="rest";rt.textContent="休息 "+e.t;meta.appendChild(rt);}
  if(lastSets){
    const top=topRep(e.r);
    const done=lastSets.filter(v=>v&&v.r!=="").length>=e.s && lastSets.slice(0,e.s).every(v=>v&&Number(v.r)>=top);
    meta.appendChild(txt("上次 "+(last.date||"").slice(5).replace("-","/")+"（"+last.id.split("_")[1]+"）"));
    if(done && !e.bw){const p=document.createElement("span");p.className="pill";p.textContent="可加重";meta.appendChild(p);}
  } else if(e.ref){ meta.appendChild(txt("舊記錄 "+e.ref)); }
  if(!e.bw){
    const u=document.createElement("button");u.type="button";u.className="unit";u.textContent=unit;
    u.title="切換 kg / lb";
    u.onclick=()=>{S.units[e.k]=unit==="kg"?"lb":"kg";touch();renderList();};
    meta.appendChild(u);
  }
  c.appendChild(meta);

  const sets=document.createElement("div");sets.className="sets";
  for(let s=0;s<n;s++){
    const row=document.createElement("div");row.className="set"+(e.bw?" bw":"");
    const cur=(S.sets[e.k]||[])[s]||{};
    const prev=lastSets?lastSets[s]:null;
    row.appendChild(Object.assign(document.createElement("div"),{className:"set-n",textContent:"第"+(s+1)+"組"}));
    if(!e.bw){
      row.appendChild(field(e.k,s,"w",cur.w,prev&&prev.w,unit,"重量"));
      row.appendChild(Object.assign(document.createElement("div"),{className:"x",textContent:"×"}));
    }
    row.appendChild(field(e.k,s,"r",cur.r,prev&&prev.r,e.bw||"下","次數"));
    sets.appendChild(row);
  }
  c.appendChild(sets);
  const add=document.createElement("button");add.type="button";add.className="add";add.textContent="+ 加一組";
  add.onclick=()=>{const a=S.sets[e.k]||(S.sets[e.k]=[]);while(a.length<n)a.push({w:"",r:""});a.push({w:"",r:""});renderList();};
  c.appendChild(add);
  return c;
}
function txt(t){const s=document.createElement("span");s.textContent=t;return s}
function field(k,s,f,val,ph,suffix,label){
  const w=document.createElement("div");w.className="field";
  const i=document.createElement("input");
  i.id="f-"+k+"-"+s+"-"+f; i.inputMode="decimal"; i.autocomplete="off";
  i.setAttribute("aria-label",label+" 第"+(s+1)+"組");
  i.value=val??""; i.placeholder=(ph!=null&&ph!=="")?ph:"";
  i.oninput=()=>{
    const v=i.value.replace(/[^0-9.]/g,""); if(v!==i.value) i.value=v;
    const a=S.sets[k]||(S.sets[k]=[]); while(a.length<=s)a.push({w:"",r:""});
    a[s]={...a[s],[f]:v}; touch();
  };
  const em=document.createElement("em");em.textContent=suffix||"";
  w.append(i,em);return w;
}

function renderHist(){
  $("histTitle").textContent=S.day+" 過往記錄";
  const H=$("hist");H.innerHTML="";
  const list=S.sessions.filter(x=>x.day===S.day).sort((a,b)=>key(b).localeCompare(key(a)));
  if(!list.length){const p=document.createElement("div");p.className="empty";p.textContent="仲未有 "+S.day+" 記錄。填完第一組就會自動儲存。";H.appendChild(p);return;}
  list.slice(0,30).forEach(x=>{
    const n=Object.values(x.sets||{}).reduce((t,a)=>t+a.filter(v=>v&&v.r!=="").length,0);
    const first=PLAN[S.day].ex.find(e=>!e.bw && x.sets&&x.sets[e.k]&&x.sets[e.k].some(v=>v&&v.w!==""));
    let best="";
    if(first){const top=x.sets[first.k].filter(v=>v&&v.w!=="").sort((a,b)=>Number(b.w)-Number(a.w))[0];
      best=" · "+first.n+" "+top.w+((x.units&&x.units[first.k])||first.u)+(top.r?" × "+top.r:"");}
    const row=document.createElement("div");row.className="h"+(x.id===S.curId?" current":"");
    row.innerHTML='<span class="d"></span><span class="s"></span>';
    row.querySelector(".d").textContent=(x.date||"").replace(/-/g,"/");
    row.querySelector(".s").textContent=n+" 組"+best;
    const open=document.createElement("button");open.type="button";open.className="btn";open.textContent=x.id===S.curId?"編輯緊":"打開";
    open.disabled=x.id===S.curId;
    open.onclick=()=>{flush();load(x);};
    const del=document.createElement("button");del.type="button";del.className="btn";del.textContent="刪除";
    del.onclick=()=>{
      if(del.dataset.confirm){store.remove(x.id).catch(()=>setStatus("刪除失敗"));if(x.id===S.curId)blank(S.date);}
      else{del.dataset.confirm="1";del.textContent="確定刪除？";setTimeout(()=>{if(del.isConnected){delete del.dataset.confirm;del.textContent="刪除";}},4000);}
    };
    row.append(open,del);H.appendChild(row);
  });
}

/* ---------- save (debounced, one write at a time) ---------- */
let timer=null, chain=Promise.resolve();
function touch(){S.dirty=true;setStatus("未儲存…");clearTimeout(timer);timer=setTimeout(flush,1200);}
function flush(){
  clearTimeout(timer);
  if(!S.dirty) return chain;
  S.dirty=false;
  if(!hasData()){setStatus("");return chain;}
  const id=S.curId||(S.curId=newId(S.date,S.day));
  const body={day:S.day,date:S.date,sets:JSON.parse(JSON.stringify(S.sets)),units:{...S.units},updated:new Date().toISOString()};
  setStatus("儲存中…");
  chain=chain.then(()=>store.save(id,body)).then(async()=>{
    setStatus("已儲存 ✓",true); renderHist();
  }).catch(e=>{S.dirty=true;setStatus(e&&e.code==="quota_exceeded"?"儲存空間已滿，未能儲存":"儲存失敗，稍後再試");});
  return chain;
}

function load(x){
  S.date=x.date;S.day=x.day;S.sets=JSON.parse(JSON.stringify(x.sets||{}));S.units={...(x.units||{})};S.curId=x.id;S.dirty=false;
  $("date").value=S.date; renderAll(); setStatus("");
}
// A blank form for this date and day; nothing is saved until you fill in a set.
function blank(date){
  S.date=date;S.sets={};S.units={};S.curId=null;S.dirty=false;
  $("date").value=S.date; renderAll(); setStatus("新一次："+date.slice(5).replace("-","/")+" "+S.day);
}
// Go to a date: open that day's record if there is one, else a blank form.
function openDate(date){ const ex=findFor(date,S.day); if(ex) load(ex); else blank(date); }
function renderAll(){renderTabs();renderList();renderHist();}

$("date").onchange=()=>{ const d=$("date").value; if(!d) return; flush(); openDate(d); };
$("newBtn").onclick=()=>{ flush(); blank(today()); };
window.addEventListener("pagehide",flush);
document.addEventListener("visibilitychange",()=>{if(document.hidden)flush();});

$("date").value=S.date;
renderAll();
let first=true;
store.init(list=>{
  S.sessions=cleanAll(list);
  if(first && list.length){ first=false; const t=findFor(S.date,S.day); if(t && !S.dirty && !hasData() && !S.curId){ load(t); return; } }
  const typing=document.activeElement&&document.activeElement.tagName==="INPUT"&&$("list").contains(document.activeElement);
  if(!S.dirty && !typing){ renderList(); }
  renderHist();
});

$("exportBtn").onclick=exportJson;
$("importBtn").onclick=()=>$("importFile").click();
$("importFile").onchange=e=>{const f=e.target.files[0]; if(f) importJson(f); e.target.value="";};
if("serviceWorker" in navigator){ window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{})); }
