import test from 'node:test'
import assert from 'node:assert/strict'
import { inventoryAt,validateRoomChange,createInventoryBlock,rateTransition } from './inventoryRules.js'
import { physicalRooms,extendStay } from './bookingRules.js'
const rooms=[{id:'a',name:'Alpha',stock:4,guests:2,rate:100,note:'Room only'},{id:'b',name:'Beta',stock:2,guests:2,rate:200,note:'Breakfast'}]
const b={id:'booking',room:'a',quantity:2,start:'2026-10-15',end:'2026-10-18',total:600}
const today='2026-10-15'
test('daily stock subtracts reservation, physical blocks and dated blocks; ends excluded',()=>{
 const room={...rooms[0],blocks:[{start:today,end:'2026-10-17',quantity:1}]}
 assert.deepEqual(inventoryAt(room,today,[b],{'204':{status:'Blocked'}},rooms),{capacity:4,blocked:2,reserved:2,remaining:0})
 assert.equal(inventoryAt(room,'2026-10-18',[b],{},rooms).remaining,4)
})
test('stock decrease cannot overbook future reservations',()=>{
 const next=[{...rooms[0],stock:1},rooms[1]]
 assert.throws(()=>validateRoomChange(rooms,next,[b],{},today),/Insufficient/)
 assert.doesNotThrow(()=>validateRoomChange(rooms,[{...rooms[0],stock:2},rooms[1]],[b],{},today))
})
test('room IDs remain stable and historical references cannot be removed',()=>{
 assert.deepEqual(physicalRooms([{...rooms[0],stock:5},rooms[1]]).filter(u=>u.type==='b').map(u=>u.id),['301','302'])
 assert.throws(()=>validateRoomChange(rooms,[{...rooms[0],stock:3},rooms[1]],[{...b,status:'Checked-out',roomNumbers:['204']}],{},today),/history/)
 assert.throws(()=>validateRoomChange(rooms,[rooms[1],rooms[0]],[],{},today),/order/)
})
test('overlapping dated blocks cannot reduce stock below reservations',()=>{
 const once=createInventoryBlock(rooms[0],{start:today,end:'2026-10-17',quantity:1,reason:'Repairs'},today,'one')
 const twice=createInventoryBlock(once,{start:today,end:'2026-10-18',quantity:2,reason:'Repairs'},today,'two')
 assert.doesNotThrow(()=>validateRoomChange(rooms,[once,rooms[1]],[b],{},today))
 assert.throws(()=>validateRoomChange(rooms,[twice,rooms[1]],[b],{},today),/Insufficient/)
 assert.throws(()=>createInventoryBlock(rooms[0],{start:today,end:today,quantity:1,reason:'Repair'},today,'bad'))
})
test('rate draft and submission retain published rate, approval publishes and logs',()=>{
 const draft=rateTransition(rooms[0],'draft',{rate:'125.50',reason:'Seasonal'},'stamp')
 assert.equal(draft.rate,100)
 const pending=rateTransition(draft,'submit',{},'stamp');assert.equal(pending.rate,100)
 const published=rateTransition(pending,'approve',{},'stamp');assert.equal(published.rate,125.5);assert.equal(published.rateDraft,null);assert.equal(published.rateHistory[0].previousRate,100);assert.equal(b.total,600)
})
test('rejecting rates requires reason; stale drafts and invalid rates rejected',()=>{
 const pending=rateTransition(rateTransition(rooms[0],'draft',{rate:'120',reason:'Change'},'stamp'),'submit',{},'stamp')
 assert.throws(()=>rateTransition(pending,'reject',{reason:''},'stamp'))
 assert.equal(rateTransition(pending,'reject',{reason:'Revise'},'stamp').rate,100)
 assert.throws(()=>rateTransition({...pending,rate:101},'approve',{},'stamp'),/changed/)
 for(const rate of ['0','-1','1.111','NaN'])assert.throws(()=>rateTransition(rooms[0],'draft',{rate,reason:'Change'},'stamp'))
})
test('extension respects dated sellable-inventory blocks',()=>{
 assert.throws(()=>extendStay({...b,quantity:1,status:'Checked-in',roomNumbers:['201']},'2026-10-20',100,[{...b,id:'other',start:'2026-10-18',end:'2026-10-20',quantity:2}],physicalRooms(rooms),{},4,[{start:'2026-10-18',end:'2026-10-20',quantity:2}]),/insufficient/)
})
