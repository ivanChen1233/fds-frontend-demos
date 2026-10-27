import { statusOf, stayNights, folioTotals } from './bookingRules.js'
export function guestDirectory(bookings,profiles) {
 const deleted=new Set(profiles.filter(p=>p.deleted).map(p=>p.id))
 const map=new Map(profiles.filter(p=>!p.deleted).map(p=>[p.id,{...p,stays:[]}]))
 for(const b of bookings){const id=b.guest.profileId||`booking:${b.id}`;if(deleted.has(id))continue;if(!map.has(id))map.set(id,{...b.guest,id,stays:[]});map.get(id).stays.push(b)}
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name))
}
const day=86400000
const utc=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;const [y,m,d]=s.split('-').map(Number);const value=Date.UTC(y,m-1,d);return new Date(value).toISOString().slice(0,10)===s?value:NaN}
export function buildReport(bookings,rooms,from,to){
 const start=utc(from),end=utc(to)
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||(end-start)/day>365)throw new Error('Select a valid date range of up to 366 days.')
 const stock=rooms.reduce((sum,r)=>sum+r.stock,0)
 const eligible=bookings.filter(b=>!['Cancelled','No-show'].includes(statusOf(b)))
 const daily=[]
 for(let date=start;date<=end;date+=day){const key=new Date(date).toISOString().slice(0,10);const staying=eligible.filter(b=>b.start<=key&&b.end>key);const sold=staying.reduce((sum,b)=>sum+b.quantity,0);daily.push({date:key,rooms:sold,available:Math.max(0,stock-sold),occupancy:stock?sold/stock*100:0,roomChargesCents:staying.reduce((sum,b)=>sum+(Math.floor(Math.round(b.total*100)/Math.max(1,stayNights(b.start,b.end)))+(Math.round((date-utc(b.start))/day)<Math.round(b.total*100)%Math.max(1,stayNights(b.start,b.end))?1:0)),0)})}
 const matches=eligible.filter(b=>b.start<=to&&b.end>from)
 const sources=Object.entries(matches.reduce((acc,b)=>{const source=b.guest.source||'Walk-in';acc[source]=(acc[source]||0)+1;return acc},{})).map(([name,count])=>({name,count}))
 const payments=bookings.flatMap(b=>(b.payments||[]).filter(p=>{const date=p.date.slice(0,10);return date>=from&&date<=to}).map(p=>({...p,bookingId:b.id,guest:b.guest.name})))
 const roomNights=daily.reduce((sum,d)=>sum+d.rooms,0),roomChargesCents=daily.reduce((sum,d)=>sum+d.roomChargesCents,0)
 return {daily,matches,sources,payments,roomNights,roomChargesCents,occupancy:stock?roomNights/(stock*daily.length)*100:0,averageRateCents:roomNights?Math.round(roomChargesCents/roomNights):0,paymentCents:payments.reduce((sum,p)=>sum+p.amountCents,0),outstandingCents:matches.reduce((sum,b)=>sum+Math.max(0,folioTotals(b).balance),0)}
}
export function csvText(rows){return rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}).join(',')).join('\r\n')}
export function downloadCsv(rows,filename){const url=URL.createObjectURL(new Blob(['\ufeff'+csvText(rows)],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)}

export function deleteGuestProfile(role,id,profiles,bookings) {
 if(!['admin','manager'].includes(role))throw new Error('Only admins and managers can delete guest profiles.')
 if(!guestDirectory(bookings,profiles).some(profile=>profile.id===id))throw new Error('Guest profile not found.')
 // A minimal marker prevents a booking snapshot from recreating the deleted directory entry.
 return [...profiles.filter(profile=>profile.id!==id),{id,deleted:true}]
}
