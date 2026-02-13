const $=q=>document.querySelector(q);

async function init(){
  $("#date").value = new Date().toISOString().slice(0,10);
  const ar = await fetch("/api/areas?city=Delhi").then(r=>r.json());
  const areas = (ar.ok?ar.data:["Saket"]);
  $("#area").innerHTML = areas.map(a=>`<option value="${a}">${a}</option>`).join("");
}
function go(){
  const area=$("#area").value||"Saket";
  const date=$("#date").value;
  location.href=`/list?city=Delhi&area=${encodeURIComponent(area)}&date=${encodeURIComponent(date)}`;
}
$("#bookNow").addEventListener("click", go);
init().catch(console.error);
