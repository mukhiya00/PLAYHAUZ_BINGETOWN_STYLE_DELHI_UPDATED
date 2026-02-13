const $=q=>document.querySelector(q);
async function load(){
  const r=await fetch("/api/bookings");
  const j=await r.json();
  const tb=$("#tbody"); tb.innerHTML="";
  j.data.forEach(b=>{
    const tr=document.createElement("tr");
    tr.innerHTML = `
      <td>${b.booking_id}</td>
      <td>${b.created_at}</td>
      <td>${b.theatre_name}</td>
      <td>${b.date_ymd} ${b.start_time}</td>
      <td>${Math.round(b.duration_min/60)}h</td>
      <td>${b.customer_name}</td>
      <td>${b.whatsapp}</td>
      <td>${b.email||""}</td>
    `;
    tb.appendChild(tr);
  });
}
load().catch(console.error);
