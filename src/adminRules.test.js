import test from 'node:test'
import assert from 'node:assert/strict'
import { guestDirectory,buildReport,csvText } from './adminRules.js'
const rooms=[{id:'def',stock:2}]
const booking={id:'b1',room:'def',start:'2026-10-01',end:'2026-10-04',quantity:1,total:100,guest:{name:'Sample',phone:'123',source:'Walk-in'}}
test('guest names are not automatically merged',()=>{
 const result=guestDirectory([booking,{...booking,id:'b2'}],[])
 assert.equal(result.length,2)
})
test('explicit profiles group stays while preserving booking snapshots',()=>{
 const b={...booking,guest:{...booking.guest,profileId:'g1'}}
 const result=guestDirectory([b,{...b,id:'b2'}],[{id:'g1',name:'Updated',phone:'456'}])
 assert.equal(result.length,1);assert.equal(result[0].stays.length,2);assert.equal(result[0].name,'Updated');assert.equal(booking.guest.name,'Sample')
})
test('report excludes checkout nights and cancelled bookings, retains departed historical stays',()=>{
 const r=buildReport([{...booking,status:'Checked-out'},{...booking,id:'cancel',status:'Cancelled'}],rooms,'2026-10-01','2026-10-04')
 assert.equal(r.roomNights,3);assert.equal(r.daily[3].rooms,0);assert.equal(r.occupancy,37.5);assert.equal(r.matches.length,1)
})
test('report distributes room charges exactly to cents and clips partial periods',()=>{
 assert.equal(buildReport([booking],rooms,'2026-10-01','2026-10-03').roomChargesCents,10000)
 assert.equal(buildReport([booking],rooms,'2026-10-02','2026-10-03').roomChargesCents,6666)
})
test('payments use record date independent of stay period',()=>{
 const r=buildReport([{...booking,payments:[{id:'p',date:'2026-10-10T12:00:00Z',amountCents:5000}]}],rooms,'2026-10-10','2026-10-10')
 assert.equal(r.roomNights,0);assert.equal(r.paymentCents,5000)
})
test('invalid and excessive ranges rejected, leap days included',()=>{
 for(const [from,to] of [['2026-10-02','2026-10-01'],['','2026-10-01'],['2026-02-30','2026-03-01'],['2026-01-01','2027-01-02']])assert.throws(()=>buildReport([],rooms,from,to))
 assert.equal(buildReport([],rooms,'2028-02-28','2028-03-01').daily.length,3)
})
test('CSV quotes commas, newlines and spreadsheet formula prefixes',()=>{
 const csv=csvText([['=SUM(A1)','a,b','a"b','line\nbreak',' +cmd']])
 assert.ok(csv.includes('"\'=SUM(A1)"'));assert.ok(csv.includes('"a,b"'));assert.ok(csv.includes('"a""b"'));assert.ok(csv.includes('"\' +cmd"'))
})

import { deleteGuestProfile } from './adminRules.js'
test('guest deletion is allowed only for admin and manager roles',()=>{
 const profiles=[{id:'g1',name:'Sample Guest',phone:'123'}]
 for(const role of ['admin','manager'])assert.deepEqual(deleteGuestProfile(role,'g1',profiles,[]),[{id:'g1',deleted:true}])
 for(const role of ['front_desk',undefined,'unknown'])assert.throws(()=>deleteGuestProfile(role,'g1',profiles,[]),/Only admins/)
 assert.equal(profiles[0].name,'Sample Guest')
})
test('deleted linked guest stays out of the directory while booking history remains intact',()=>{
 const b={...booking,guest:{...booking.guest,profileId:'g1'}}
 const original=JSON.stringify(b)
 const next=deleteGuestProfile('admin','g1',[{id:'g1',name:'Sample Guest',email:'sample@example.test'}],[b])
 assert.deepEqual(guestDirectory([b],next),[])
 assert.equal(JSON.stringify(b),original)
 assert.equal('email'in next[0],false)
 assert.deepEqual(guestDirectory([b],JSON.parse(JSON.stringify(next))),[])
})
test('booking-derived guests can be deleted without being recreated from old stays',()=>{
 const next=deleteGuestProfile('manager',`booking:${booking.id}`,[],[booking])
 assert.deepEqual(guestDirectory([booking],next),[])
 assert.throws(()=>deleteGuestProfile('admin','missing',next,[booking]),/not found/)
})
