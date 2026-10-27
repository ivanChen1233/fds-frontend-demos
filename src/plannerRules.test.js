import test from 'node:test'
import assert from 'node:assert/strict'
import { monthDates,monthlyInventory,bookingInPlanner } from './plannerRules.js'
const room={id:'a',name:'Alpha',rate:250,stock:4,guests:2,units:[{id:'201'},{id:'202'},{id:'203'},{id:'204'}]}
const booking={id:'b',room:'a',quantity:2,start:'2026-10-15',end:'2026-10-18',guest:{name:'Sample'}}
test('monthly calendar has correct lengths, weekdays and leap years',()=>{
 assert.equal(monthDates(2026,9).length,31)
 assert.equal(monthDates(2026,1).length,28)
 assert.equal(monthDates(2028,1).length,29)
 assert.equal(monthDates(2026,11).at(-1),'2026-12-31')
 assert.equal(new Date(monthDates(2026,9)[0]+'T12:00:00').getDay(),4)
})
test('allotment subtracts physical and dated blocks, balance subtracts bookings',()=>{
 const r={...room,blocks:[{start:'2026-10-15',end:'2026-10-16',quantity:1}]}
 const n=monthlyInventory(r,'2026-10-15',[booking],{'204':{status:'Blocked'}},[r])
 assert.equal(n.allotment,2);assert.equal(n.reserved,2);assert.equal(n.remaining,0);assert.equal(n.state,'full')
})
test('checkout dates excluded and cancelled/no-show reservations ignored',()=>{
 const n=monthlyInventory(room,'2026-10-18',[booking],{},[room]);assert.equal(n.reserved,0);assert.equal(n.state,'available')
 const cancelled=monthlyInventory(room,'2026-10-15',[{...booking,status:'Cancelled'},{...booking,status:'No-show'}],{},[room]);assert.equal(cancelled.reserved,0)
})
test('departed reservations count for historical booked nights without mutating status',()=>{
 const b={...booking,status:'Checked-out'}
 assert.equal(monthlyInventory(room,'2026-10-15',[b],{},[room]).reserved,2)
 assert.equal(b.status,'Checked-out')
})
test('unpublished and zero-allotment types show no allocation',()=>{
 assert.equal(monthlyInventory({...room,publication:'Draft'},'2026-10-15',[],{},[room]).state,'unallocated')
 const zero={...room,stock:0,units:[]}
 assert.equal(monthlyInventory(zero,'2026-10-15',[],{},[zero]).state,'unallocated')
})
test('invalid negative stock is flagged instead of hidden',()=>{
 const n=monthlyInventory(room,'2026-10-15',[{...booking,quantity:5}],{},[room]);assert.equal(n.remaining,-1);assert.equal(n.state,'invalid')
})

test('early departure frees future monthly and physical stock, retaining past nights',()=>{
 const b={...booking,status:'Checked-out',actualCheckOutDate:'2026-10-16'}
 assert.equal(monthlyInventory(room,'2026-10-15',[b],{},[room],'2026-10-20').reserved,2)
 assert.equal(monthlyInventory(room,'2026-10-16',[b],{},[room],'2026-10-20').reserved,0)
 assert.equal(bookingInPlanner(b,'2026-10-16','2026-10-20'),false)
 const legacy={...booking,status:'Checked-out',end:'2026-10-25'}
 assert.equal(monthlyInventory(room,'2026-10-20',[legacy],{},[room],'2026-10-20').reserved,0)
 assert.equal(bookingInPlanner(legacy,'2026-10-21','2026-10-20'),false)
 assert.equal(legacy.end,'2026-10-25')
})

import {rollingDates,dailySummary} from './plannerRules.js'
test('rolling planner fills 14 days across month/year and leap boundaries',()=>{
 assert.equal(rollingDates('2026-10-24').at(-1),'2026-11-06')
 assert.equal(rollingDates('2026-12-25').at(-1),'2027-01-07')
 assert.equal(rollingDates('2028-02-28',3).at(-1),'2028-03-01')
})
test('stop sell preserves bookings and occupancy but releases no inventory after cancellations',()=>{
 const closed={...room,stopSellDates:[{date:'2026-10-15',reason:'Close sales'}]}
 const n=monthlyInventory(closed,'2026-10-15',[booking],{},[closed])
 assert.equal(n.remaining,0);assert.equal(n.reserved,2)
 const summary=dailySummary([closed],'2026-10-15',[booking],{},'2026-10-15')
 assert.equal(summary.occupancy,50);assert.equal(summary.remaining,0)
 assert.equal(monthlyInventory(closed,'2026-10-15',[],{},[closed]).remaining,0)
 assert.equal(monthlyInventory(closed,'2026-10-16',[],{},[closed]).remaining,4)
})
