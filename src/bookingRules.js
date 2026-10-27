export const statusOf = b => b.status || 'Upcoming'
export const occupiesInventory = b => !['Cancelled','Checked-out','No-show'].includes(statusOf(b))
export const physicalRooms = rooms => rooms.flatMap((r,index)=>(r.units || Array.from({length:r.stock},(_,i)=>({id:String((index+2)*100+i+1)}))).map(unit=>({...unit,type:r.id,name:r.name})))
export function roomsForBooking(booking) { return booking.roomNumbers || (booking.roomNumber ? [booking.roomNumber] : []) }
export function allocationsFor(b) { return b.allocations || [{start:b.start,end:b.end,numbers:roomsForBooking(b)}] }
export function roomsOnDate(b,date) { return allocationsFor(b).find(a=>a.start<=date&&a.end>date)?.numbers || [] }
export function canAssign(booking,numbers,bookings,units,cleaning) {
 return numbers.length===booking.quantity && new Set(numbers).size===numbers.length && numbers.every(number=>units.some(u=>u.id===number&&u.type===booking.room) && cleaning[number]?.status!=='Blocked' && !bookings.some(other=>other.id!==booking.id&&occupiesInventory(other)&&allocationsFor(other).some(a=>a.start<booking.end&&a.end>booking.start&&a.numbers.includes(number))))
}
const utc = value => { const [y,m,d]=value.split('-').map(Number);return Date.UTC(y,m-1,d) }
export const stayNights = (start,end) => Math.round((utc(end)-utc(start))/86400000)
export function moveStay(b,numbers,date,bookings,units,cleaning,reason) {
 if(statusOf(b)!=='Checked-in'||date<b.start||date>=b.end)throw new Error('Room moves require an active checked-in stay.')
 if(!reason?.trim())throw new Error('Enter a reason for the move.')
 if(numbers.every(n=>roomsForBooking(b).includes(n)))throw new Error('Choose at least one different room.')
 if(!canAssign({...b,start:date},numbers,bookings,units,cleaning)||numbers.some(n=>!roomsForBooking(b).includes(n)&&(cleaning[n]?.status||'Clean')!=='Clean'))throw new Error('Choose clean rooms available for all remaining nights.')
 const history=allocationsFor(b).filter(a=>a.start<date).map(a=>({...a,end:a.end>date?date:a.end}))
 return {...b,roomNumbers:numbers,allocations:[...history,{start:date,end:b.end,numbers}],roomMoves:[...(b.roomMoves||[]),{date,from:roomsForBooking(b),to:numbers,reason:reason.trim()}]}
}
export function extendStay(b,end,rate,bookings,units,cleaning,stock,blocks=[]) {
 const nights=stayNights(b.end,end)
 if(statusOf(b)!=='Checked-in'||!Number.isFinite(nights)||nights<1||nights>365)throw new Error('Choose a later check-out date, up to 365 additional nights.')
 if(!canAssign({...b,start:b.end,end},roomsForBooking(b),bookings,units,cleaning))throw new Error('The assigned rooms are unavailable for these extra nights.')
 for(let i=utc(b.end);i<utc(end);i+=86400000){const date=new Date(i).toISOString().slice(0,10);const reserved=bookings.filter(o=>o.id!==b.id&&occupiesInventory(o)&&o.room===b.room&&o.start<=date&&o.end>date).reduce((sum,o)=>sum+o.quantity,0);if(stock-units.filter(u=>u.type===b.room&&cleaning[u.id]?.status==='Blocked').length-blocks.filter(block=>block.start<=date&&block.end>date).reduce((sum,block)=>sum+block.quantity,0)-reserved<b.quantity)throw new Error('Room inventory is insufficient for the extension.')}
 const extraCents=typeof rate==='function'?Array.from({length:nights},(_,i)=>Math.round(rate(new Date(Date.parse(b.end+'T12:00:00Z')+i*86400000).toISOString().slice(0,10))*100)*b.quantity).reduce((a,b)=>a+b,0):Math.round(rate*100)*nights*b.quantity
 const allocations=allocationsFor(b).map((a,i,list)=>i===list.length-1?{...a,end}:a)
 return {...b,end,total:(Math.round(b.total*100)+extraCents)/100,allocations,extensions:[...(b.extensions||[]),{start:b.end,end,nights,amountCents:extraCents}]}
}
export function receiptCharges(subtotal){
 const sst=Math.round(subtotal*6/100),service=Math.round(subtotal*10/100)
 return {subtotal,sst,service,total:subtotal+sst+service}
}
export function folioTotals(b) {
 const breakdown=receiptCharges(Math.round(b.total*100)+(b.charges||[]).reduce((sum,c)=>sum+c.amountCents,0))
 const charges=breakdown.total,paid=(b.payments||[]).reduce((sum,p)=>sum+p.amountCents,0)
 return {...breakdown,charges,paid,balance:charges-paid,status:charges-paid===0?'Paid':paid>0?'Partially Paid':'Unpaid'}
}
export function amountCents(value) {
 if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw new Error('Enter an amount with up to two decimal places.')
 const cents=Math.round(Number(value)*100)
 if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000)throw new Error('Enter an amount between RM 0.01 and RM 1,000,000.')
 return cents
}
export function addFolioEntry(b,kind,entry) {
 if(['Cancelled','No-show'].includes(statusOf(b)))throw new Error('This reservation cannot accept billing entries.')
 const cents=amountCents(entry.amount)
 if(kind==='payments'&&cents>folioTotals(b).balance)throw new Error('Payment cannot exceed the outstanding balance.')
 if(kind==='charges'&&!entry.description?.trim())throw new Error('Enter a description.')
 const reference=(entry.paymentReference??entry.description??'').trim()
 if(kind==='payments'&&entry.method!=='Cash'&&!reference)throw new Error('Enter a payment reference for non-cash payments.')
 const record={id:entry.id,date:entry.date,description:kind==='payments'?reference:entry.description.trim(),amountCents:cents,...(kind==='payments'?{method:entry.method,paymentReference:reference,receiptNo:`RCP-${entry.id||crypto.randomUUID()}`}: {})}
 return {...b,[kind]:[...(b[kind]||[]),record]}
}
