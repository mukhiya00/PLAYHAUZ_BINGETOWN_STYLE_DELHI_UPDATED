const $=q=>document.querySelector(q);
const $$=q=>Array.from(document.querySelectorAll(q));
const money=n=>`₹${Number(n||0)}`;

async function init(){
  const params = new URLSearchParams(location.search);
  const city = params.get("city") || "Delhi";
  const area = params.get("area") || "Saket";
  const date = params.get("date") || new Date().toISOString().slice(0,10);

  $("#cityLine").textContent = city;
  $("#areaLine").textContent = area;
  $("#dateLine").textContent = date;

  const r = await fetch(`/api/theatres?city=${encodeURIComponent(city)}&area=${encodeURIComponent(area)}&date=${encodeURIComponent(date)}`);
  const j = await r.json();
  const wrap=$("#cards"); wrap.innerHTML="";
  j.data.forEach(th=>{
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML = `
      <div class="row-between">
        <div>
          <div style="font-weight:900;font-size:16px">${th.name}</div>
          <div class="muted small">${th.area}, ${th.city}</div>
        </div>
        <div class="badge">★ ${th.rating}</div>
      </div>
      <div style="margin-top:10px">
        <img src="${th.image}" style="width:100%;height:220px;object-fit:cover;border-radius:16px;border:1px solid rgba(31,36,64,.7)" alt="">
      </div>
      <div class="row-between" style="margin-top:10px">
        <div style="font-weight:900;font-size:18px">${money(th.base_price)}</div>
        <div class="muted small">${th.slots_available} Slots Available</div>
      </div>
      <div class="slots" id="slots_${th.id}"></div>
      <div class="actions"><button class="btn small" data-book="${th.id}">Proceed</button></div>
    `;
    wrap.appendChild(card);
    loadSlots(th.id, date);
  });

  wrap.addEventListener("click",(e)=>{
    const btn=e.target.closest("[data-book]");
    if(!btn) return;
    const id=btn.getAttribute("data-book");
    const picked=document.querySelector(`#slots_${id} .slot.selected`);
    if(!picked) return alert("Select time slot first");
    const time=picked.getAttribute("data-time");
    const dur=picked.getAttribute("data-dur");
    location.href = `/booking/new?city=${encodeURIComponent(city)}&area=${encodeURIComponent(area)}&date=${encodeURIComponent(date)}&theatre_id=${encodeURIComponent(id)}&time=${encodeURIComponent(time)}&dur=${encodeURIComponent(dur)}`;
  });
}

async function loadSlots(theatreId, date){
  const r=await fetch(`/api/slots?theatre_id=${encodeURIComponent(theatreId)}&date=${encodeURIComponent(date)}`);
  const j=await r.json();
  const wrap=$("#slots_"+theatreId); wrap.innerHTML="";
  j.data.forEach(s=>{
    const full=s.remaining<=0;
    const el=document.createElement("div");
    el.className="slot";
    el.setAttribute("aria-disabled", full?"true":"false");
    el.setAttribute("data-time", s.start_time);
    el.setAttribute("data-dur", s.duration_min);
    el.innerHTML=`${s.start_time}<small>${Math.round(s.duration_min/60)}h • ${full?"Full":(s.remaining+" left")}</small>`;
    el.addEventListener("click",()=>{
      if(full) return;
      $$("#slots_"+theatreId+" .slot").forEach(x=>x.classList.remove("selected"));
      el.classList.add("selected");
    });
    wrap.appendChild(el);
  });
}

init().catch(console.error);
