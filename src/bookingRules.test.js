import test from 'node:test'
import assert from 'node:assert/strict'
import { occupiesInventory, canAssign } from './bookingRules.js'
const units=[{id:'201',type:'def'},{id:'202',type:'def'},{id:'301',type:'twin'}]
const booking={id:'a',room:'def',quantity:1,start:'2026-10-15',end:'2026-10-18'}
test('cancelled and checked-out reservations release inventory',()=>{
  assert.equal(occupiesInventory(booking),true)
  assert.equal(occupiesInventory({...booking,status:'Cancelled'}),false)
  assert.equal(occupiesInventory({...booking,status:'Checked-out'}),false)
})
test('room assignment rejects overlapping occupancy and wrong room types',()=>{
 const other={...booking,id:'b',roomNumbers:['201']}
 assert.equal(canAssign(booking,['201'],[other],units,{}),false)
 assert.equal(canAssign(booking,['202'],[other],units,{}),true)
 assert.equal(canAssign(booking,['301'],[],units,{}),false)
})
test('checkout-exclusive dates allow back-to-back stays',()=>{
 const other={...booking,id:'b',start:'2026-10-18',end:'2026-10-20',roomNumbers:['201']}
 assert.equal(canAssign(booking,['201'],[other],units,{}),true)
})
test('assign every room, reject duplicates and blocked rooms',()=>{
 assert.equal(canAssign({...booking,quantity:2},['201'],[],units,{}),false)
 assert.equal(canAssign({...booking,quantity:2},['201','201'],[],units,{}),false)
 assert.equal(canAssign({...booking,quantity:2},['201','202'],[],units,{}),true)
 assert.equal(canAssign(booking,['201'],[],units,{'201':{status:'Blocked'}}),false)
})
test('cancelled bookings do not prevent a new physical assignment',()=>{
 assert.equal(canAssign(booking,['201'],[{...booking,id:'b',status:'Cancelled',roomNumbers:['201']}],units,{}),true)
})
import { moveStay, extendStay, roomsOnDate, folioTotals, addFolioEntry, amountCents } from './bookingRules.js'
const inHouse={...booking,status:'Checked-in',roomNumbers:['201'],total:750,guest:{name:'Test'}}
test('room move preserves old allocation and charges',()=>{
 const moved=moveStay(inHouse,['202'],'2026-10-16',[],units,{},'Quieter room')
 assert.deepEqual(roomsOnDate(moved,'2026-10-15'),['201'])
 assert.deepEqual(roomsOnDate(moved,'2026-10-16'),['202'])
 assert.equal(moved.total,750)
 assert.equal(canAssign({...booking,id:'new',start:'2026-10-15',end:'2026-10-16'},['201'],[moved],units,{}),false)
 assert.equal(canAssign({...booking,id:'new',start:'2026-10-16'},['201'],[moved],units,{}),true)
})
test('room move rejects dirty rooms, wrong quantity and unchanged assignment',()=>{
 assert.throws(()=>moveStay(inHouse,['202'],'2026-10-16',[],units,{'202':{status:'Dirty'}},'Move'))
 assert.throws(()=>moveStay(inHouse,[],'2026-10-16',[],units,{},'Move'))
 assert.throws(()=>moveStay(inHouse,['201'],'2026-10-16',[],units,{},'Move'))
})
test('extension adds only new room charges, preserving ledger',()=>{
 const paid={...inHouse,payments:[{amountCents:10000}]}
 const extended=extendStay(paid,'2026-10-20',250,[],units,{},4)
 assert.equal(extended.total,1250)
 assert.equal(extended.start,inHouse.start)
 assert.deepEqual(roomsOnDate(extended,'2026-10-19'),['201'])
 assert.equal(folioTotals(extended).paid,10000)
})
test('extension rejects room conflicts, invalid dates and insufficient aggregate stock',()=>{
 assert.throws(()=>extendStay(inHouse,'2026-10-18',250,[],units,{},4))
 assert.throws(()=>extendStay(inHouse,'2026-10-20',250,[{...booking,id:'b',start:'2026-10-18',end:'2026-10-20',roomNumbers:['201']}],units,{},4))
 assert.throws(()=>extendStay(inHouse,'2026-10-20',250,[{...booking,id:'b',start:'2026-10-18',end:'2026-10-20',quantity:4}],units,{},4))
})
test('ledger computes exact cents, partial payment and settlement',()=>{
 const charged=addFolioEntry(inHouse,'charges',{id:'c',date:'2026-10-15',amount:'10.25',description:'Laundry'})
 const partial=addFolioEntry(charged,'payments',{id:'p',date:'2026-10-15',amount:'500.10',description:'Receipt 1',method:'Cash'})
 assert.deepEqual(folioTotals(partial),{subtotal:76025,sst:4562,service:7603,total:88190,charges:88190,paid:50010,balance:38180,status:'Partially Paid'})
 const settled=addFolioEntry(partial,'payments',{amount:'381.80',description:'Receipt 2',method:'Cash'})
 assert.equal(folioTotals(settled).balance,0)
 assert.equal(folioTotals(settled).status,'Paid')
})
test('ledger rejects overpayment and malformed amounts',()=>{
 for(const value of ['0','-1','NaN','1.001','1e3'])assert.throws(()=>amountCents(value))
 assert.throws(()=>addFolioEntry(inHouse,'payments',{amount:'870.01',description:'Overpayment'}))
 assert.throws(()=>addFolioEntry(inHouse,'charges',{amount:'1',description:' '}))
})

test('payments separate generated receipts from references and permit cash without reference',()=>{
 const cash=addFolioEntry(inHouse,'payments',{id:'cash-1',date:'2026-10-15',amount:'10',method:'Cash',paymentReference:''})
 assert.equal(cash.payments.at(-1).receiptNo,'RCP-cash-1')
 assert.equal(cash.payments.at(-1).paymentReference,'')
 assert.throws(()=>addFolioEntry(inHouse,'payments',{id:'bank-1',amount:'10',method:'Bank transfer (record only)',paymentReference:'  '}),/payment reference/)
 const bank=addFolioEntry(cash,'payments',{id:'bank-2',date:'2026-10-15',amount:'10',method:'Bank transfer (record only)',paymentReference:' TX-123 '})
 assert.equal(bank.payments.at(-1).paymentReference,'TX-123')
 assert.equal(bank.payments.at(-1).receiptNo,'RCP-bank-2')
 assert.equal(bank.payments[0].receiptNo,'RCP-cash-1')
})

import {receiptCharges} from './bookingRules.js'
test('SST and service charges apply independently to all charges, rounded to cents',()=>{
 assert.deepEqual(receiptCharges(100000),{subtotal:100000,sst:6000,service:10000,total:116000})
 const booking={total:250,charges:[{amountCents:5000}],payments:[{amountCents:34800}]}
 assert.equal(folioTotals(booking).balance,0)
 assert.equal(folioTotals(booking).sst,1800)
 assert.equal(folioTotals(booking).service,3000)
 assert.equal(booking.total,250)
})
