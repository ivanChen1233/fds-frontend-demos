import { physicalRooms, occupiesInventory } from './bookingRules.js'
import { validateRoomChange } from './inventoryRules.js'
export const isBookable = room => !room.publication || room.publication==='Published'
export function normalizeRooms(rooms){return rooms.map((r,index)=>({...r,units:r.units||Array.from({length:r.stock},(_,i)=>({id:String((index+2)*100+i+1),floor:'',notes:''}))}))}
export function resizeRoomStock(rooms,id,count){
 const normalized=normalizeRooms(rooms),room=normalized.find(r=>r.id===id)
 if(!room||!Number.isInteger(count)||count<0||count>99)throw new Error('Choose a stock count between 0 and 99.')
 const used=new Set(physicalRooms(normalized).map(u=>u.id))
 const units=room.units.slice(0,count)
 let number=(rooms.findIndex(r=>r.id===id)+2)*100+1
 while(units.length<count){while(used.has(String(number)))number++;const next={id:String(number++),floor:'',notes:''};used.add(next.id);units.push(next)}
 return normalized.map(r=>r.id===id?{...r,stock:count,units}:r)
}
export function addRoomType(rooms,draft,id){
 const rate=Number(draft.rate),guests=Number(draft.guests)
 if(!draft.name?.trim()||!draft.category?.trim()||!Number.isInteger(guests)||guests<1||guests>20||!/^\d+(\.\d{1,2})?$/.test(String(draft.rate))||rate<=0||rate>1000000)throw new Error('Enter a name, category, 1–20 guests and a valid positive base rate.')
 if(rooms.some(r=>r.name.trim().toLowerCase()===draft.name.trim().toLowerCase()||r.id===id))throw new Error('A room type with this name already exists.')
 return [...normalizeRooms(rooms),{id,name:draft.name.trim(),category:draft.category.trim(),guests,rate,stock:0,units:[],note:draft.note?.trim()||'Room only',facilities:draft.facilities?.trim()||'',publication:'Draft',publicationHistory:[]}]
}
export function updatePhysicalRoom(rooms,type,unitId,draft){
 const normalized=normalizeRooms(rooms),room=normalized.find(r=>r.id===type)
 if(!room)throw new Error('Select a room type.')
 if(!unitId){if(!/^[A-Za-z0-9-]{1,15}$/.test(draft.id||''))throw new Error('Use a room number of up to 15 letters, numbers or hyphens.');if(physicalRooms(normalized).some(u=>u.id.toLowerCase()===draft.id.toLowerCase()))throw new Error('Room number already exists.');if(room.stock>=99)throw new Error('A room type can contain at most 99 rooms.')}
 const unit={id:unitId||draft.id,floor:(draft.floor||'').trim(),notes:(draft.notes||'').trim()}
 return normalized.map(r=>r.id===type?{...r,units:unitId?r.units.map(u=>u.id===unitId?unit:u):[...r.units,unit],stock:r.stock+(unitId?0:1)}:r)
}
export function removePhysicalRoom(rooms,type,id,bookings,cleaning,today){
 const next=normalizeRooms(rooms).map(r=>r.id===type?{...r,units:r.units.filter(u=>u.id!==id),stock:r.units.filter(u=>u.id!==id).length}:r)
 return validateRoomChange(normalizeRooms(rooms),next,bookings,cleaning,today)
}
export function publicationTransition(room,action,reason,bookings,today,stamp){
 const status=room.publication||'Published'
 let next
 if(action==='submit'&&['Draft','Rejected'].includes(status))next='Pending Approval'
 else if(action==='approve'&&status==='Pending Approval'){if(!room.stock)throw new Error('Add at least one physical room before publishing.');next='Published'}
 else if(action==='reject'&&status==='Pending Approval'){if(!reason?.trim())throw new Error('Enter a rejection reason.');next='Rejected'}
 else if(action==='archive'&&status!=='Archived'){
 if(bookings.some(b=>b.room===room.id&&occupiesInventory(b)&&b.end>today))throw new Error('Cannot archive a type with current or future active reservations.')
 if(room.blocks?.some(b=>b.end>today))throw new Error('Release future dated inventory blocks before archiving.')
 next='Archived'
 }else if(action==='restore'&&status==='Archived')next='Draft'
 else throw new Error('This publication action is not available.')
 return {...room,publication:next,publicationHistory:[...(room.publicationHistory||[]),{from:status,to:next,reason:reason?.trim()||'',date:stamp}]}
}
