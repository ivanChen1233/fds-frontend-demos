import { occupiesInventory, physicalRooms, allocationsFor } from './bookingRules.js'
export function inventoryAt(room,date,bookings,cleaning={},allRooms=[room],ignoreId=null){
 const capacity=room.stock
 const physicalBlocked=physicalRooms(allRooms).filter(u=>u.type===room.id&&cleaning[u.id]?.status==='Blocked').length
 const datedBlocked=(room.blocks||[]).filter(b=>b.start<=date&&b.end>date).reduce((sum,b)=>sum+b.quantity,0)
 const reserved=bookings.filter(b=>b.id!==ignoreId&&occupiesInventory(b)&&b.room===room.id&&b.start<=date&&b.end>date).reduce((sum,b)=>sum+b.quantity,0)
 const stopSell=(room.stopSellDates||[]).some(item=>item.date===date)
 const blocked=physicalBlocked+datedBlocked+(stopSell?Math.max(0,capacity-physicalBlocked-datedBlocked-reserved):0)
 return {capacity,blocked,reserved,remaining:capacity-blocked-reserved,...(stopSell?{stopSell,operationalAllotment:capacity-physicalBlocked-datedBlocked}:{})}
}
export function validateRoomChange(rooms,next,bookings,cleaning,today){
 if(next.length<rooms.length||rooms.some((r,i)=>r.id!==next[i].id))throw new Error('Room type order and identifiers must remain unchanged.')
 const physicalIds=physicalRooms(next).map(u=>u.id)
 if(new Set(next.map(r=>r.id)).size!==next.length||new Set(physicalIds).size!==physicalIds.length)throw new Error('Room type IDs and physical room numbers must be unique.')
 if(next.some(r=>r.units&&r.stock!==r.units.length))throw new Error('Physical stock must match the room list.')
 if(new Set(next.map(r=>r.name.trim().toLowerCase())).size!==next.length)throw new Error('Room type names must be unique.')
 for(const room of next){
 if(!room.name?.trim()||!Number.isInteger(room.guests)||room.guests<1||room.guests>20||!Number.isInteger(room.stock)||room.stock<0||room.stock>99)throw new Error('Use a room name, 1–20 guests and 0–99 physical rooms.')
 const ids=new Set(physicalRooms(next).filter(u=>u.type===room.id).map(u=>u.id))
 const previousIds=physicalRooms(rooms).filter(u=>u.type===room.id).map(u=>u.id)
 const removed=previousIds.filter(id=>!ids.has(id))
 if(bookings.some(b=>b.room===room.id&&allocationsFor(b).some(a=>a.numbers.some(id=>removed.includes(id)))))throw new Error('Cannot remove rooms referenced by reservation history or assignments.')
 if(removed.some(id=>cleaning[id]&&cleaning[id].status!=='Clean'))throw new Error('Resolve housekeeping tasks before removing these rooms.')
 const dates=new Set([today,...bookings.filter(b=>b.room===room.id&&occupiesInventory(b)&&b.end>today).flatMap(b=>[b.start<today?today:b.start,b.end]),...(room.blocks||[]).filter(b=>b.end>today).flatMap(b=>[b.start<today?today:b.start,b.end])])
 for(const date of dates)if(inventoryAt(room,date,bookings,cleaning,next).remaining<0)throw new Error(`Insufficient sellable stock for ${room.name} on ${date}.`)
 }
 return next
}
export function createInventoryBlock(room,draft,today,id){
 const quantity=Number(draft.quantity)
 if(!draft.start||!draft.end||draft.start<today||draft.end<=draft.start||!Number.isInteger(quantity)||quantity<1||quantity>room.stock||!draft.reason?.trim())throw new Error('Choose future dates, a positive whole-room quantity and a reason. End date is excluded.')
 return {...room,blocks:[...(room.blocks||[]),{id,start:draft.start,end:draft.end,quantity,reason:draft.reason.trim()}]}
}
export function rateTransition(room,action,input,stamp){
 if(action==='draft'){
 if(!/^\d+(\.\d{1,2})?$/.test(String(input.rate))||Number(input.rate)<=0||Number(input.rate)>1000000||!input.reason?.trim())throw new Error('Enter a positive MYR rate with up to two decimal places and a reason.')
 return {...room,rateDraft:{rate:Number(input.rate),reason:input.reason.trim(),status:'Draft',baseRate:room.rate}}
 }
 const draft=room.rateDraft
 if(!draft)throw new Error('Create a rate draft first.')
 if(action==='submit'&&draft.status==='Draft')return {...room,rateDraft:{...draft,status:'Pending Approval'}}
 if(action==='approve'&&draft.status==='Pending Approval'){
 if(draft.baseRate!==room.rate)throw new Error('The published rate changed. Create a fresh draft.')
 return {...room,rate:draft.rate,rateDraft:null,rateHistory:[...(room.rateHistory||[]),{...draft,status:'Published',date:stamp,previousRate:room.rate}]}
 }
 if(action==='reject'&&draft.status==='Pending Approval'){
 if(!input.reason?.trim())throw new Error('Enter a rejection reason.')
 return {...room,rateDraft:{...draft,status:'Rejected',rejectionReason:input.reason.trim()}}
 }
 throw new Error('This action is not available for the current rate status.')
}
