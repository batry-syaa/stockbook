(function(){
  var KEY="spbt-stok-v2", app=document.getElementById("app"), books=[];
  var TYPES=["Buku Teks","Buku Aktiviti"];
  var FIELDS=[["o","Stok lama","old stock"],["n","Stok baru","new stock"],["b","Pinjaman","borrowed"],["r","Pulang","returned"],["d","Rosak / lupus","damaged"]];

  function uid(){return "b"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
  function mk(y,t,ty,o,n,b,r,d){return {id:uid(),y:y,t:t,ty:ty,o:o||0,n:n||0,b:b||0,r:r||0,d:d||0,ts:Date.now()}}
  function load(){
    try{var s=localStorage.getItem(KEY); if(s){books=JSON.parse(s)||[]; return}}catch(e){}
    books=[mk(1,"Bahasa Melayu","Buku Teks"),mk(1,"Matematik","Buku Teks",50,150,180,175,3),mk(1,"Matematik","Buku Aktiviti")];
  }
  var synced={}, timer=null, firstSync=true;
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(books))}catch(e){}
    if(!window.cloud)return;
    window.cloud.status("Menyimpan...");
    clearTimeout(timer);timer=setTimeout(push,600);
  }
  function push(){
    if(!window.cloud)return;
    var ids={};
    books.forEach(function(b){
      ids[b.id]=1;var j=JSON.stringify(b);
      if(synced[b.id]!==j){synced[b.id]=j;window.cloud.put(b)}
    });
    Object.keys(synced).forEach(function(id){if(!ids[id]){delete synced[id];window.cloud.del(id)}});
  }
  window.spbtRemote=function(list){
    if(firstSync){
      firstSync=false;
      if(!list.length){synced={};push();return}
    }
    list.sort(function(a,b){return (a.ts||0)-(b.ts||0)});
    books=list;synced={};
    list.forEach(function(b){synced[b.id]=JSON.stringify(b)});
    try{localStorage.setItem(KEY,JSON.stringify(books))}catch(e){}
    var ae=document.activeElement;
    if(ae&&app.contains(ae)&&/INPUT|SELECT/.test(ae.tagName))return;
    route(true);
  };
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function num(v){v=parseInt(v,10);return isNaN(v)||v<0?0:v}
  function calc(x){var t=x.o+x.n-x.d;return {total:t,shelf:t-x.b+x.r,lost:x.b-x.r}}
  function find(id){return books.filter(function(b){return b.id===id})[0]}

  /* ---------- Muat turun / Cetak ---------- */
  var HEAD=["Tahun","Jenis","Tajuk buku","Stok lama","Stok baru","Pinjaman","Pulang","Rosak / lupus","Jumlah","Di rak","Hilang"];
  var pa=document.createElement("div");pa.id="printarea";document.body.appendChild(pa);
  window.addEventListener("afterprint",function(){document.body.classList.remove("print-table")});
  function sortList(l){return l.slice().sort(function(a,b){return a.y-b.y||TYPES.indexOf(a.ty)-TYPES.indexOf(b.ty)||(a.ts||0)-(b.ts||0)})}
  function rowsFor(l){return l.map(function(b){var c=calc(b);return [b.y,b.ty,b.t,b.o,b.n,b.b,b.r,b.d,c.total,c.shelf,c.lost]})}
  function withTotals(rows){
    var t=["","","Jumlah semua"];
    for(var i=3;i<HEAD.length;i++){var n=0;rows.forEach(function(r){n+=r[i]});t.push(n)}
    return rows.concat([t]);
  }
  function fname(y,bk){
    if(bk)return "buku-stok-"+(bk.t||"buku").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-tahun-"+bk.y;
    return "buku-stok-spbt-"+(y?"tahun-"+y:"semua");
  }
  function download(blob,name){
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
  }
  function toCSV(rows){
    return "\ufeff"+[HEAD].concat(rows).map(function(r){
      return r.map(function(v){v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(",");
    }).join("\r\n");
  }
  function loadXLSX(){
    return new Promise(function(res,rej){
      if(window.XLSX)return res(window.XLSX);
      var sc=document.createElement("script");
      sc.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      sc.onload=function(){res(window.XLSX)};sc.onerror=rej;document.head.appendChild(sc);
    });
  }
  function doExport(kind,y,id){
    var bk=id?find(id):null;
    if(id&&!bk)return;
    var list=bk?[bk]:sortList(y?books.filter(function(b){return b.y===y}):books);
    if(kind==="csv"){
      download(new Blob([toCSV(withTotals(rowsFor(list)))],{type:"text/csv;charset=utf-8"}),fname(y,bk)+".csv");
    }else if(kind==="xlsx"){
      loadXLSX().then(function(X){
        var wb=X.utils.book_new(),ys=bk?[bk.y]:y?[y]:[1,2,3,4,5,6].filter(function(n){return books.some(function(b){return b.y===n})});
        if(!ys.length)ys=[1];
        ys.forEach(function(yy){
          var ws=X.utils.aoa_to_sheet([HEAD].concat(withTotals(rowsFor(bk?[bk]:sortList(books.filter(function(b){return b.y===yy}))))));
          ws["!cols"]=[8,14,32,11,11,11,9,14,9,9,9].map(function(w){return {wch:w}});
          X.utils.book_append_sheet(wb,ws,"Tahun "+yy);
        });
        X.writeFile(wb,fname(y,bk)+".xlsx");
      }).catch(function(){alert("Excel tidak dapat dimuatkan. Sila guna pilihan CSV (boleh dibuka dalam Excel).")});
    }else{
      var rows=withTotals(rowsFor(list));
      pa.innerHTML='<h1>Buku Stok SPBT'+(bk?' &ndash; '+esc(bk.t)+' (Tahun '+bk.y+')':y?' &ndash; Tahun '+y:'')+'</h1><p>Dicetak: '+new Date().toLocaleDateString("ms-MY")+'</p><table><thead><tr>'+
        HEAD.map(function(h){return '<th>'+h+'</th>'}).join("")+'</tr></thead><tbody>'+
        rows.map(function(r,i){return '<tr'+(i===rows.length-1?' class="tot"':'')+'>'+r.map(function(v,j){return '<td'+(j===2?' class="l"':'')+'>'+esc(v)+'</td>'}).join("")+'</tr>'}).join("")+'</tbody></table>';
      document.body.classList.add("print-table");
      setTimeout(function(){window.print()},60);
    }
  }
  function menuHTML(y,id,label){
    return '<details class="exp" data-y="'+(y||0)+'" data-b="'+(id||"")+'"><summary>'+(label||"Muat turun / Cetak")+'</summary><div class="menu">'+
      '<button type="button" data-x="xlsx">Excel (.xlsx)</button>'+
      '<button type="button" data-x="csv">CSV (buka dalam Excel)</button>'+
      '<button type="button" data-x="pdf">PDF / Cetak</button>'+
      '<small>Untuk PDF, pilih "Save as PDF" pada dialog cetak.</small></div></details>';
  }

  function home(){
    var h='<div class="hero"><div class="logo"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7"/></svg></div><h1>Buku Stok SPBT</h1></div><p class="sub">Pilih tahun untuk lihat senarai buku teks dan buku aktiviti.</p>'+menuHTML(0)+'<div class="years">';
    for(var y=1;y<=6;y++){
      var l=books.filter(function(b){return b.y===y}), s=0;
      l.forEach(function(b){s+=calc(b).shelf});
      h+='<a class="year" href="#/year/'+y+'"><em>'+y+'</em><div><b>Tahun '+y+'</b><span>'+l.length+' buku &middot; '+s+' di rak</span></div></a>';
    }
    app.innerHTML=h+'</div>';
  }

  var mode="list";
  function year(y){
    var yb=books.filter(function(b){return b.y===y});
    var h='<a class="back" href="#/">&larr; Semua tahun</a><h1>Tahun '+y+'</h1><p class="sub">Tekan nama buku untuk lihat butiran, atau tukar ke paparan jadual untuk lihat semua sekali.</p>'+
      '<form class="addbar" id="add"><input id="nt" type="text" placeholder="Nama buku baru" aria-label="Nama buku baru" required>'+
      '<select id="nty" aria-label="Jenis buku">'+TYPES.map(function(t){return '<option>'+t+'</option>'}).join("")+'</select>'+
      '<button type="submit">+ Tambah</button></form>'+
      '<div class="seg" role="group" aria-label="Paparan"><button type="button" data-m="list" class="'+(mode==="list"?"on":"")+'">Senarai</button><button type="button" data-m="table" class="'+(mode==="table"?"on":"")+'">Jadual (semua)</button></div>'+menuHTML(y);
    if(mode==="table"){
      h+='<div class="tbl"><table><thead><tr><th>Tajuk buku</th><th>Jenis</th>'+FIELDS.map(function(f){return '<th>'+f[1]+'</th>'}).join("")+'<th>Jumlah</th><th>Di rak</th><th>Hilang</th></tr></thead><tbody>';
      var sorted=TYPES.reduce(function(acc,ty){return acc.concat(yb.filter(function(b){return b.ty===ty}))},[]);
      sorted.forEach(function(b){
        h+='<tr data-id="'+b.id+'"><td class="tt"><a href="#/book/'+b.id+'">'+esc(b.t||"(tiada nama)")+'</a></td><td class="ty">'+b.ty+'</td>'+
          FIELDS.map(function(f){return '<td><input type="number" min="0" inputmode="numeric" data-k="'+f[0]+'" value="'+b[f[0]]+'" aria-label="'+f[1]+'"></td>'}).join("")+
          '<td class="c" data-c="total"></td><td class="c" data-c="shelf"></td><td class="c l" data-c="lost"></td></tr>';
      });
      h+='</tbody><tfoot><tr><td class="tt">Jumlah semua</td><td></td>'+FIELDS.map(function(f){return '<td data-s="'+f[0]+'"></td>'}).join("")+'<td data-s="total"></td><td data-s="shelf"></td><td data-s="lost"></td></tr></tfoot></table></div>';
      if(!sorted.length)h+='<div class="none">Belum ada buku untuk tahun ini.</div>';
    }else{
      TYPES.forEach(function(ty){
        var l=yb.filter(function(b){return b.ty===ty});
        h+='<h2>'+ty+'</h2><div class="list">';
        h+=l.length?l.map(function(b){return '<a class="item" href="#/book/'+b.id+'"><b>'+esc(b.t||"(tiada nama)")+'</b><small>Di rak: '+calc(b).shelf+' &rsaquo;</small></a>'}).join(""):'<div class="none">Belum ada buku.</div>';
        h+='</div>';
      });
    }
    app.innerHTML=h;
    app.style.maxWidth=mode==="table"?"1200px":"";
    function updTable(){
      var sum={o:0,n:0,b:0,r:0,d:0,total:0,shelf:0,lost:0};
      app.querySelectorAll("tr[data-id]").forEach(function(tr){
        var b=find(tr.getAttribute("data-id")),c=calc(b);
        tr.querySelector('[data-c="total"]').textContent=c.total;
        tr.querySelector('[data-c="shelf"]').textContent=c.shelf;
        tr.querySelector('[data-c="lost"]').textContent=c.lost;
        FIELDS.forEach(function(f){sum[f[0]]+=b[f[0]]});
        sum.total+=c.total;sum.shelf+=c.shelf;sum.lost+=c.lost;
      });
      app.querySelectorAll("[data-s]").forEach(function(td){td.textContent=sum[td.getAttribute("data-s")]});
    }
    if(mode==="table"){
      updTable();
      app.querySelectorAll("tr[data-id] input").forEach(function(el){el.addEventListener("input",function(){
        find(el.closest("tr").getAttribute("data-id"))[el.getAttribute("data-k")]=num(el.value);save();updTable();
      })});
    }
    app.querySelectorAll(".seg button").forEach(function(bt){bt.addEventListener("click",function(){mode=bt.getAttribute("data-m");year(y)})});
    document.getElementById("add").addEventListener("submit",function(e){
      e.preventDefault();
      var b=mk(y,document.getElementById("nt").value.trim(),document.getElementById("nty").value);
      books.push(b);save();nav("#/book/"+b.id);
    });
  }

  function book(id){
    var b=find(id);
    if(!b){nav("#/");return}
    var h='<a class="back" href="#/year/'+b.y+'">&larr; Tahun '+b.y+'</a><div class="panel"><span class="badge">Tahun '+b.y+' &middot; '+b.ty+'</span>'+
      '<input class="title-in" id="bt" type="text" value="'+esc(b.t)+'" placeholder="Nama buku" aria-label="Nama buku"><div class="grid">';
    FIELDS.forEach(function(f){h+='<label>'+f[1]+' <small>('+f[2]+')</small><input type="number" min="0" inputmode="numeric" data-k="'+f[0]+'" value="'+b[f[0]]+'"></label>'});
    h+='</div><div class="res"><div class="r"><span>Jumlah keseluruhan</span><b id="rt"></b></div><div class="r"><span>Di rak (baki)</span><b id="rs"></b></div><div class="r lost"><span>Hilang oleh murid</span><b id="rl"></b></div></div>'+
      '<p class="note">Jumlah = stok lama + stok baru &minus; rosak. Di rak = jumlah &minus; pinjaman + pulang. Hilang = pinjaman &minus; pulang.</p>'+
      '<div class="actions">'+menuHTML(b.y,b.id,"Cetak / Muat turun")+'<button class="del" id="dl">Padam buku</button></div></div>';
    app.innerHTML=h;
    function upd(){var c=calc(b);document.getElementById("rt").textContent=c.total;document.getElementById("rs").textContent=c.shelf;document.getElementById("rl").textContent=c.lost}
    upd();
    document.getElementById("bt").addEventListener("input",function(e){b.t=e.target.value;save()});
    app.querySelectorAll("input[data-k]").forEach(function(el){el.addEventListener("input",function(){b[el.getAttribute("data-k")]=num(el.value);save();upd()})});
    document.getElementById("dl").addEventListener("click",function(){
      if(confirm("Padam buku ini?")){books=books.filter(function(x){return x.id!==id});save();nav("#/year/"+b.y)}
    });
  }

  var cur="#/";
  try{cur=location.hash||"#/"}catch(e){}
  function route(keep){
    app.style.maxWidth="";
    var p=cur.replace(/^#\/?/,"").split("/");
    if(p[0]==="year"&&+p[1]>=1&&+p[1]<=6)year(+p[1]);
    else if(p[0]==="book"&&p[1])book(p[1]);
    else home();
    if(!keep)window.scrollTo(0,0);
  }
  function nav(h){cur=h;route();try{if(location.hash!==h)location.hash=h}catch(e){}}
  app.addEventListener("click",function(e){
    var a=e.target.closest&&e.target.closest("a[href^='#/']");
    if(!a)return;
    e.preventDefault();nav(a.getAttribute("href"));
  });
  app.addEventListener("click",function(e){
    var x=e.target.closest&&e.target.closest("[data-x]");
    if(!x)return;
    var d=x.closest("details");
    doExport(x.getAttribute("data-x"),+d.getAttribute("data-y")||0,d.getAttribute("data-b")||"");
    d.open=false;
  });
  window.addEventListener("hashchange",function(){
    var h=location.hash||"#/";
    if(h!==cur){cur=h;route()}
  });
  load();route();
})();

/* ===================== FIREBASE (pangkalan data sahaja, tiada skrin log masuk) ===================== */
const firebaseConfig = {
  apiKey: "AIzaSyBrHB7cWkhX48W35dx0cxph4Kk8cFT2gcY",
  authDomain: "bukustocks.firebaseapp.com",
  projectId: "bukustocks",
  storageBucket: "bukustocks.firebasestorage.app",
  messagingSenderId: "1045423150628",
  appId: "1:1045423150628:web:44b751e472666880ceeab1"
};
try {
  const V = "10.12.2", B = "https://www.gstatic.com/firebasejs/" + V + "/";
  const [A, Au, F] = await Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js"), import(B + "firebase-firestore.js")]);
  const app = A.initializeApp(firebaseConfig);
  const auth = Au.getAuth(app);
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { db = F.getFirestore(app); }
  const warn = (e) => console.warn("Firebase:", e && e.code ? e.code : e);

  let unsub = null;
  Au.onAuthStateChanged(auth, (user) => {
    if (unsub) { unsub(); unsub = null; }
    if (!user) {
      window.cloud = null;
      Au.signInAnonymously(auth).catch(warn); // masuk senyap-senyap, tiada skrin
      return;
    }
    window.cloud = {
      put: (b) => F.setDoc(F.doc(db, "books", b.id), b).catch(warn),
      del: (id) => F.deleteDoc(F.doc(db, "books", id)).catch(warn),
      status: () => {}
    };
    unsub = F.onSnapshot(F.collection(db, "books"), (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.metadata.fromCache && snap.empty) return;
      window.spbtRemote(snap.docs.map((d) => d.data()));
    }, warn);
  });
} catch (e) {
  console.warn("Firebase tidak dapat dimuatkan. Guna simpanan dalam pelayar sahaja.", e);
}
