const $=q=>document.querySelector(q);
const $$=q=>Array.from(document.querySelectorAll(q));
const money=n=>`₹${Number(n||0)}`;

let state={
  step:1,
  city:"Delhi",
  area:"Saket",
  theatre_id:1,
  date:"",
  slot_time:"",
  duration_min:180,
  name:"",
  phone:"",
  email:"",
  adults:2,
  kids:0,
  notes:"",
  occasion:null,
  cake:null,
  addons:[]
};
let CONFIG=null;

function setStep(n){
  state.step=n;
  $$(".step-page").forEach(p=>p.classList.toggle("hidden", p.getAttribute("data-page")!=String(n)));
  $$(".step").forEach(s=>{
    const sn=Number(s.getAttribute("data-step"));
    s.classList.toggle("active", sn===n);
    s.classList.toggle("done", sn<n);
  });
  const titles={1:"Basic Details",2:"Occasion",3:"Cake",4:"Add-ons",5:"Payment"};
  $("#panelTitle").textContent=titles[n]||"";
  $("#panelHint").textContent = n===1 ? "Fill customer details & select slot." : "Complete this step.";
  renderSummary();
  if(n===5) updatePaymentBox();
}

async function loadConfig(){
  const r=await fetch("/api/config"); const j=await r.json();
  if(!j.ok) throw new Error("config");
  CONFIG=j.data;
}

function pickCard(item, selectedId, onPick){
  const el=document.createElement("div");
  el.className="pick"+(item.id===selectedId?" selected":"");
  el.innerHTML = `
    <img src="${item.image}" alt="">
    <div class="t">${item.title}</div>
    ${item.subtitle?`<div class="muted small" style="text-align:center">${item.subtitle}</div>`:""}
  `;
  el.addEventListener("click",()=>onPick(item.id));
  return el;
}

function renderOccasions(){
  const grid=$("#occasionGrid"); grid.innerHTML="";
  CONFIG.occasions.forEach(o=>{
    grid.appendChild(pickCard(o, state.occasion, (id)=>{state.occasion=id; renderOccasions(); renderSummary();}));
  });
}

function renderCakes(){
  const grid=$("#cakeGrid"); grid.innerHTML="";
  CONFIG.cakes.forEach(c=>{
    grid.appendChild(pickCard(c, state.cake, (id)=>{state.cake=id; renderCakes(); renderSummary();}));
  });
}

function groupBy(list, key){
  const m={};
  for(const it of list){
    const k=it[key]||"Other";
    (m[k]=m[k]||[]).push(it);
  }
  return m;
}

function renderAddons(){
  const wrap=$("#addonsWrap"); wrap.innerHTML="";
  const groups=groupBy(CONFIG.addons, "group_name");
  Object.keys(groups).forEach(g=>{
    const box=document.createElement("div");
    box.className="addon-group";
    box.innerHTML = `<h4>${g.replaceAll("_"," ").toUpperCase()}</h4><div class="addon-grid" id="g_${g}"></div>`;
    wrap.appendChild(box);
    const grid=box.querySelector("#g_"+CSS.escape(g));
    groups[g].forEach(a=>{
      const selected = state.addons.includes(a.id);
      const el=document.createElement("div");
      el.className="pick"+(selected?" selected":"");
      el.innerHTML = `<img src="${a.image}" alt=""><div class="t">${a.title}</div><div class="muted small" style="text-align:center">${money(a.price)}</div>`;
      el.addEventListener("click",()=>{
        // single-select for entry + gaming_duration, multi for others
        if(a.group_name==="entry" || a.group_name==="gaming_duration"){
          state.addons = state.addons.filter(id=>{
            const it=CONFIG.addons.find(x=>x.id===id);
            return it && it.group_name!==a.group_name;
          });
          state.addons.push(a.id);
        } else {
          if(state.addons.includes(a.id)) state.addons = state.addons.filter(x=>x!==a.id);
          else state.addons.push(a.id);
        }
        renderAddons();
        applyGamingDuration();
        renderSummary();
      });
      grid.appendChild(el);
    });
  });
}

function applyGamingDuration(){
  const dur = state.addons.find(id=>{
    const a=CONFIG.addons.find(x=>x.id===id);
    return a && a.group_name==="gaming_duration";
  });
  if(dur){
    const a=CONFIG.addons.find(x=>x.id===dur);
    try{
      const meta = JSON.parse(a.meta_json||"{}");
      if(meta.minutes) state.duration_min = Number(meta.minutes);
    }catch{}
  }
}

async function loadSlots(){
  const r=await fetch(`/api/slots?theatre_id=${encodeURIComponent(state.theatre_id)}&date=${encodeURIComponent(state.date)}`);
  const j=await r.json();
  const wrap=$("#slots"); wrap.innerHTML="";
  if(!j.ok){ wrap.innerHTML=`<div class="muted small">${j.error}</div>`; return; }
  j.data.forEach(s=>{
    const full=s.remaining<=0;
    const el=document.createElement("div");
    el.className="slot"+(state.slot_time===s.start_time?" selected":"");
    el.setAttribute("aria-disabled", full?"true":"false");
    el.innerHTML=`${s.start_time}<small>${Math.round(s.duration_min/60)}h • ${full?"Full":(s.remaining+" left")}</small>`;
    el.addEventListener("click",()=>{
      if(full) return;
      state.slot_time=s.start_time;
      state.duration_min=Number(s.duration_min);
      $$("#slots .slot").forEach(x=>x.classList.remove("selected"));
      el.classList.add("selected");
      renderSummary();
    });
    wrap.appendChild(el);
  });

  // if boot time exists, auto select
  const bootTime = (window.__BOOT && window.__BOOT.time) ? window.__BOOT.time : "";
  if(bootTime && !state.slot_time){
    const candidate=[...wrap.children].find(x=>x.textContent.includes(bootTime));
    if(candidate){ candidate.click(); }
  }
}

function renderSummary(){
  const list=$("#sumList"); list.innerHTML="";
  const lines=[];
  lines.push(["Theatre", `ID ${state.theatre_id}`]);
  lines.push(["Location", state.area]);
  lines.push(["Date", state.date]);
  if(state.slot_time) lines.push(["Slot", state.slot_time]);
  lines.push(["Duration", `${Math.round(state.duration_min/60)} hour`]);
  if(state.occasion){
    const o=CONFIG && CONFIG.occasions.find(x=>x.id===state.occasion);
    lines.push(["Occasion", o?o.title:state.occasion]);
  }
  if(state.cake){
    const c=CONFIG && CONFIG.cakes.find(x=>x.id===state.cake);
    lines.push(["Cake", c?c.title:state.cake]);
  }
  if(state.addons.length){
    lines.push(["Add-ons", `${state.addons.length} selected`]);
  }
  lines.forEach(([k,v])=>{
    const row=document.createElement("div");
    row.className="sum-item";
    row.innerHTML=`<span class="muted">${k}</span><strong>${v}</strong>`;
    list.appendChild(row);
  });
  // totals dummy
  $("#sumTotal").textContent="₹0";
  $("#sumAdvSide").textContent="₹0";
  $("#sumBalSide").textContent="₹0";
}

function updatePaymentBox(){
  $("#sumTop").textContent="₹0";
  $("#sumAdvance").textContent="₹0";
  $("#sumBalance").textContent="₹0";
}

function bindNavButtons(){
  $("#to2").addEventListener("click",()=>{
    state.name=$("#name").value.trim();
    state.phone=$("#phone").value.trim();
    state.email=$("#email").value.trim();
    state.adults=Number($("#adults").value||2);
    state.kids=Number($("#kids").value||0);
    state.notes=$("#notes").value.trim();
    if(!state.date) return alert("Select date");
    if(!state.slot_time) return alert("Select time slot");
    if(!state.name) return alert("Enter name");
    if(!state.phone) return alert("Enter whatsapp");
    setStep(2);
  });
  $$("[data-prev]").forEach(b=>b.addEventListener("click",()=>setStep(Math.max(1,state.step-1))));
  $$("[data-next]").forEach(b=>b.addEventListener("click",()=>{
    if(state.step===2 && !state.occasion) return alert("Select occasion");
    setStep(Math.min(5,state.step+1));
  }));
  $("#refreshSlots").addEventListener("click",loadSlots);
  $("#confirm").addEventListener("click", async ()=>{
    const payload={
      city:state.city,
      area:state.area,
      theatre_id:state.theatre_id,
      date_ymd:state.date,
      start_time:state.slot_time,
      duration_min:state.duration_min,
      customer_name:state.name,
      whatsapp:state.phone,
      email:state.email,
      people_adults:state.adults,
      people_kids:state.kids,
      occasion_id:state.occasion,
      cake_id:state.cake,
      addons:state.addons,
      notes:state.notes
    };
    const r=await fetch("/api/book",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const j=await r.json();
    if(!j.ok) return alert(j.error||"Failed");
    const box=$("#done");
    box.classList.remove("hidden");
    box.innerHTML = `<strong>Booking Confirmed!</strong><div class="muted small">Booking ID: ${j.data.booking_id}</div>`;
  });
}

async function boot(){
  const boot = window.__BOOT || {};
  state.area = boot.area || "Saket";
  state.theatre_id = Number(boot.theatre_id || 1);
  state.date = boot.date || new Date().toISOString().slice(0,10);
  $("#date").value = state.date;

  document.getElementById("backToList").href = `/list?city=Delhi&area=${encodeURIComponent(state.area)}&date=${encodeURIComponent(state.date)}`;

  $("#date").addEventListener("change",()=>{
    state.date=$("#date").value;
    renderSummary();
    loadSlots();
  });

  await loadConfig();
  renderOccasions();
  renderCakes();
  renderAddons();
  await loadSlots();
  renderSummary();
  bindNavButtons();
  setStep(1);
}

boot().catch(err=>{console.error(err); alert("Failed to load booking");});
