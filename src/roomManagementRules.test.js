import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRooms,resizeRoomStock,addRoomType,updatePhysicalRoom,removePhysicalRoom,publicationTransition,isBookable } from './roomManagementRules.js'
import { physicalRooms } from './bookingRules.js'
import { validateRoomChange } from './inventoryRules.js'
const legacy=[{id:'a',name:'Alpha',stock:2,guests:2,rate:100,note:'Room only'},{id:'b',name:'Beta',stock:1,guests:2,rate:200,note:'Breakfast'}]
const today='2026-10-15'
test('migration preserves all existing room identifiers',()=>{
 assert.deepEqual(physicalRooms(normalizeRooms(legacy)).map(u=>u.id),['201','202','301'])
 assert.deepEqual(normalizeRooms(normalizeRooms(legacy)),normalizeRooms(legacy))
})
test('new types start unbookable, and appending does not renumber existing rooms',()=>{
 const next=addRoomType(legacy,{name:'New Suite',category:'Suites',guests:3,rate:'300.50'},'new')
 assert.equal(isBookable(next.at(-1)),false);assert.equal(next.at(-1).stock,0)
 assert.deepEqual(physicalRooms(next).map(u=>u.id),['201','202','301'])
 assert.doesNotThrow(()=>validateRoomChange(legacy,next,[],{},today))
})
test('physical numbers are unique across all types; edits keep stable IDs',()=>{
 assert.throws(()=>updatePhysicalRoom(legacy,'a',null,{id:'301'}),/exists/)
 const next=updatePhysicalRoom(legacy,'a',null,{id:'A-101',floor:'1',notes:'Corner'})
 assert.equal(next[0].stock,3)
 const edit=updatePhysicalRoom(next,'a','A-101',{id:'changed',floor:'2',notes:'Updated'})
 assert.equal(edit[0].units.at(-1).id,'A-101');assert.equal(edit[0].units.at(-1).floor,'2')
})
test('resizing stock avoids custom numbers and preserves other type IDs',()=>{
 const next=updatePhysicalRoom(legacy,'b',null,{id:'203'})
 const resized=resizeRoomStock(next,'a',3)
 assert.deepEqual(resized[0].units.map(u=>u.id),['201','202','204'])
 assert.deepEqual(resized[1].units.map(u=>u.id),['301','203'])
})
test('room removal blocks historical assignment and overbooking',()=>{
 const booking={id:'old',room:'a',quantity:1,start:'2026-10-01',end:'2026-10-02',status:'Checked-out',roomNumbers:['202']}
 assert.throws(()=>removePhysicalRoom(legacy,'a','202',[booking],{},today),/history/)
 assert.throws(()=>removePhysicalRoom(legacy,'a','202',[{...booking,status:'Upcoming',start:today,end:'2026-10-18',quantity:2,roomNumbers:[]}],{},today),/Insufficient/)
 const next=removePhysicalRoom(legacy,'a','201',[],{},today)
 assert.deepEqual(next[0].units.map(u=>u.id),['202'])
})
test('publication requires submission and physical stock before approval',()=>{
 const room=addRoomType(legacy,{name:'Suite',category:'Suites',guests:2,rate:'100'},'new').at(-1)
 assert.throws(()=>publicationTransition(room,'approve','',[],today,'stamp'))
 const pending=publicationTransition(room,'submit','',[],today,'stamp')
 assert.throws(()=>publicationTransition(pending,'approve','',[],today,'stamp'),/physical/)
 const published=publicationTransition({...pending,stock:1,units:[{id:'901'}]},'approve','',[],today,'stamp')
 assert.equal(isBookable(published),true);assert.equal(published.publicationHistory.length,2)
})
test('rejection needs a reason and archival retains history',()=>{
 const room={...legacy[0],publication:'Pending Approval'}
 assert.throws(()=>publicationTransition(room,'reject','',[],today,'stamp'))
 const rejected=publicationTransition(room,'reject','Needs review',[],today,'stamp');assert.equal(isBookable(rejected),false)
 const archived=publicationTransition(legacy[0],'archive','Retired',[],today,'stamp');assert.equal(isBookable(archived),false)
 assert.equal(publicationTransition(archived,'restore','',[],today,'stamp').publication,'Draft')
})
test('archival rejects active reservations or future inventory blocks',()=>{
 assert.throws(()=>publicationTransition(legacy[0],'archive','',[{room:'a',start:today,end:'2026-10-18'}],today,'stamp'),/reservations/)
 assert.throws(()=>publicationTransition({...legacy[0],blocks:[{start:today,end:'2026-10-18'}]},'archive','',[],today,'stamp'),/blocks/)
})
