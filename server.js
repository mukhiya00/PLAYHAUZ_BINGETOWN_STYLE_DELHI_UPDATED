const path = require("path");
const fs = require("fs");
const express = require("express");
const Database = require("better-sqlite3");

const app = express();
app.use(express.json({limit:"2mb"}));

const PORT = process.env.PORT || 3000;
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, "data", "playhauz.sqlite");
fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });

const db = new Database(SQLITE_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS theatres(
  id INTEGER PRIMARY KEY,
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  name TEXT NOT NULL,
  rating REAL DEFAULT 4.9,
  base_price INTEGER DEFAULT 0,
  max_people INTEGER DEFAULT 8,
  image TEXT
);
CREATE TABLE IF NOT EXISTS slots(
  id INTEGER PRIMARY KEY,
  theatre_id INTEGER NOT NULL,
  date_ymd TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 5,
  booked_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(theatre_id, date_ymd, start_time)
);
CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  theatre_id INTEGER NOT NULL,
  theatre_name TEXT NOT NULL,
  date_ymd TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  people_adults INTEGER DEFAULT 2,
  people_kids INTEGER DEFAULT 0,
  occasion_id TEXT,
  cake_id TEXT,
  addons_json TEXT DEFAULT '[]',
  notes TEXT,
  total INTEGER DEFAULT 0,
  advance INTEGER DEFAULT 0,
  balance INTEGER DEFAULT 0
);
`);

const seeded = db.prepare("SELECT COUNT(*) as c FROM theatres").get().c > 0;
if (!seeded) {
  const insT = db.prepare(`INSERT INTO theatres(city,area,name,rating,base_price,max_people,image) VALUES(?,?,?,?,?,?,?)`);
  [
    ["Delhi","Saket","Neon Lounge",4.9,0,8,"/public/assets/theatres/t1.webp"],
    ["Delhi","Saket","Glow Room",4.9,0,8,"/public/assets/theatres/t2.webp"],
    ["Delhi","Saket","Aurora Theatre",4.9,0,8,"/public/assets/theatres/t3.webp"],
    ["Delhi","Saket","Radiant Theatre",4.9,0,8,"/public/assets/theatres/t4.webp"],
  ].forEach(r=>insT.run(...r));

  const insS = db.prepare(`INSERT OR IGNORE INTO slots(theatre_id,date_ymd,start_time,duration_min,capacity,booked_count) VALUES(?,?,?,?,?,?)`);
  const times = ["12:00 PM","02:00 PM","05:00 PM","08:00 PM"];
  const today = new Date();
  for (let d=0; d<25; d++){
    const dt=new Date(today); dt.setDate(today.getDate()+d);
    const ymd=dt.toISOString().slice(0,10);
    for (const thId of [1,2,3,4]){
      for (const t of times){
        const cap=5;
        const booked = (Math.random()<0.18)?5:(Math.random()<0.25?4:Math.floor(Math.random()*3));
        insS.run(thId, ymd, t, 180, cap, booked);
      }
    }
  }
}

app.use("/public", express.static(path.join(__dirname, "public")));

app.get("/", (_,res)=>res.sendFile(path.join(__dirname,"views","index.html")));
app.get("/list", (_,res)=>res.sendFile(path.join(__dirname,"views","list.html")));
app.get("/booking/new", (_,res)=>res.sendFile(path.join(__dirname,"views","booking.html")));
app.get("/admin", (_,res)=>res.sendFile(path.join(__dirname,"views","admin.html")));

app.get("/api/config", (_,res)=>res.json({ok:true,data:require("./server_config.json")}));
app.get("/api/cities", (_,res)=>res.json({ok:true,data:["Delhi"]}));

app.get("/api/areas", (req,res)=>{
  const city=(req.query.city||"Delhi").trim();
  const rows=db.prepare("SELECT DISTINCT area FROM theatres WHERE city=? ORDER BY area").all(city).map(r=>r.area);
  res.json({ok:true,data:rows.length?rows:["Saket"]});
});

app.get("/api/theatres", (req,res)=>{
  const city=(req.query.city||"Delhi").trim();
  const area=(req.query.area||"Saket").trim();
  const date=(req.query.date||"").trim();
  const rows=db.prepare("SELECT * FROM theatres WHERE city=? AND area=? ORDER BY id").all(city,area);
  const out=rows.map(r=>{
    let slots_available=null;
    if(date){
      const c=db.prepare("SELECT COUNT(*) as c FROM slots WHERE theatre_id=? AND date_ymd=? AND (capacity-booked_count)>0")
        .get(r.id,date).c;
      slots_available=c;
    }
    return {...r, slots_available};
  });
  res.json({ok:true,data:out});
});

app.get("/api/slots", (req,res)=>{
  const theatre_id=Number(req.query.theatre_id||0);
  const date=(req.query.date||"").trim();
  if(!theatre_id||!date) return res.json({ok:false,error:"Missing theatre_id/date"});
  const rows=db.prepare(`
    SELECT start_time,duration_min,(capacity-booked_count) as remaining
    FROM slots WHERE theatre_id=? AND date_ymd=? ORDER BY id
  `).all(theatre_id,date);
  res.json({ok:true,data:rows});
});

function makeId(){
  return "PHZ"+Math.random().toString(16).slice(2,8).toUpperCase()+Date.now().toString().slice(-6);
}

app.post("/api/book", (req,res)=>{
  const b=req.body||{};
  const required=["city","area","theatre_id","date_ymd","start_time","duration_min","customer_name","whatsapp"];
  for(const k of required) if(!b[k]) return res.json({ok:false,error:`Missing ${k}`});
  const th=db.prepare("SELECT * FROM theatres WHERE id=?").get(Number(b.theatre_id));
  if(!th) return res.json({ok:false,error:"Invalid theatre"});
  const slot=db.prepare("SELECT * FROM slots WHERE theatre_id=? AND date_ymd=? AND start_time=?")
    .get(Number(b.theatre_id), b.date_ymd, b.start_time);
  if(!slot) return res.json({ok:false,error:"Slot not found"});
  if((slot.capacity-slot.booked_count)<=0) return res.json({ok:false,error:"Slot is full"});

  const booking_id=makeId();
  const addons=Array.isArray(b.addons)?b.addons:[];
  db.prepare(`
    INSERT INTO bookings(booking_id,city,area,theatre_id,theatre_name,date_ymd,start_time,duration_min,customer_name,whatsapp,email,people_adults,people_kids,occasion_id,cake_id,addons_json,notes,total,advance,balance)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    booking_id, b.city, b.area, Number(b.theatre_id), th.name,
    b.date_ymd, b.start_time, Number(b.duration_min),
    String(b.customer_name).trim(), String(b.whatsapp).trim(), (b.email||"").trim(),
    Number(b.people_adults||2), Number(b.people_kids||0),
    b.occasion_id||null, b.cake_id||null, JSON.stringify(addons),
    (b.notes||"").trim(), 0,0,0
  );

  db.prepare("UPDATE slots SET booked_count=booked_count+1 WHERE theatre_id=? AND date_ymd=? AND start_time=?")
    .run(Number(b.theatre_id), b.date_ymd, b.start_time);

  res.json({ok:true,data:{booking_id}});
});

app.get("/api/bookings", (_,res)=>{
  const rows=db.prepare("SELECT * FROM bookings ORDER BY id DESC LIMIT 200").all();
  res.json({ok:true,data:rows});
});

app.listen(PORT, ()=>console.log("PLAYHAUZ running on", PORT));
