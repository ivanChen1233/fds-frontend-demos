import { receiptCharges } from './bookingRules'
import Profile from './Profile'
import { deleteGuestProfile } from './adminRules'
import StaffManagement from './StaffManagement'
import { roleLabels, demoMode } from './authApi'
import { useEffect, useRef, useState, useTransition } from 'react'
import './App.css'
import GuestDetails from './GuestDetails'
import Operations from './Operations'
import Billing from './Billing'
import Guests from './Guests'
import Reports from './Reports'
import Settings from './Settings'
import {nightlyRate,stayPrice} from './pricingRules'
import { normalizeRooms, isBookable } from './roomManagementRules'
import { inventoryAt } from './inventoryRules'

const initialRooms = [
  { id: 'def', name: 'President DEF', rate: 250, stock: 4, guests: 2, note: 'Breakfast included' },
  { id: 'abc', name: 'President ABC', rate: 50, stock: 4, guests: 3, note: 'Breakfast ×2' },
  { id: 'twin', name: 'Superior Twin Single', rate: 148, stock: 6, guests: 3, note: 'Room only' },
  { id: 'queen', name: 'Deluxe Queen', rate: 148, stock: 3, guests: 2, note: 'Breakfast' },
  { id: 'deluxe', name: 'Deluxe ABC', rate: 2198, stock: 2, guests: 2, note: 'No deposit' },
  { id: 'king', name: 'Deluxe King Room 2', rate: 0, stock: 0, guests: 4, note: 'Breakfast ×2' },
  { id: 'triple', name: 'Deluxe Triple Single', rate: 188, stock: 5, guests: 3, note: 'Room only' },
]
const dayMs = 86400000
const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const parse = value => { const [y,m,d] = value.split('-').map(Number); return new Date(y,m-1,d,12) }
const add = (date,n) => new Date(date.getFullYear(),date.getMonth(),date.getDate()+n,12)
const nightsBetween = (a,b) => Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/dayMs)
const pretty = date => date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
const money = amount => new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'}).format(amount)
function loadBookings() { try { return JSON.parse(localStorage.getItem('miri-bookings') || '[]') } catch { return [] } }

const defaultSettings={propertyName:'Demo Hotel Miri',city:'Miri',staffName:'Front Desk Staff',arrivalTime:'14:00',contactEmail:'',contactPhone:'',logoDataUrl:''}
function loadLocal(name,fallback){try{const value=JSON.parse(localStorage.getItem(name));return value ?? fallback}catch{return fallback}}
export default function App({user,onSignOut,onUserUpdate}) {
 const [mobileNav,setMobileNav]=useState(()=>window.matchMedia('(max-width: 800px)').matches)
 const [sidebarOpen,setSidebarOpen]=useState(()=>!window.matchMedia('(max-width: 800px)').matches)
 const menuToggle=useRef(null),sidebarRef=useRef(null)
 useEffect(()=>{const media=window.matchMedia('(max-width: 800px)');const change=()=>{setMobileNav(media.matches);setSidebarOpen(!media.matches)};media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
 useEffect(()=>{if(!sidebarOpen)return;const previous=document.activeElement;const oldOverflow=document.body.style.overflow;if(mobileNav){document.body.style.overflow='hidden';sidebarRef.current?.querySelector('button')?.focus()}const key=e=>{if(e.key==='Escape'){setSidebarOpen(false);menuToggle.current?.focus()}if(mobileNav&&e.key==='Tab'){const buttons=sidebarRef.current?.querySelectorAll('button');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(mobileNav){document.body.style.overflow=oldOverflow;previous?.focus()}}},[sidebarOpen,mobileNav])
 const canManageStaff=['admin','manager'].includes(user.role)
 const [rooms,setRooms]=useState(()=>normalizeRooms(loadLocal('miri-rooms',initialRooms)))
 const cleaning=loadLocal('miri-cleaning',{})

 const [settings,setSettings]=useState(()=>({...defaultSettings,...loadLocal('miri-settings',{})}))
 const [profiles,setProfiles]=useState(()=>loadLocal('miri-guests',[]))
 function deleteProfile(id){try{const next=deleteGuestProfile(user.role,id,profiles,bookings);if(!saveLocal('miri-guests',next,setProfiles))return false;if(guest.profileId===id){const cleared={...guest};delete cleared.profileId;for(const key of ['name','phone','email','nationality','identity','address','language','requests'])cleared[key]='';setGuest(cleared)}return true}catch(error){setNotice(error.message);return false}}
 function saveLocal(name,value,setValue){try{localStorage.setItem(name,JSON.stringify(value));setValue(value);return true}catch{return false}}

  const [today] = useState(() => parse(key(new Date())))
  const [week,setWeek] = useState(today)
  const [selection,setSelection] = useState(null)
  const [summaryReady,setSummaryReady] = useState(false)
  const [filter,setFilter] = useState('all')
  const [bookings,setBookings] = useState(loadBookings)
  const [activePage,setPageState] = useState('Booking')
  const page=activePage==='Inventory'?'Settings':activePage
  const [pagePending,startPageTransition]=useTransition()
  function setPage(next){startPageTransition(()=>setPageState(next))}
  const [bookingStep,setBookingStep] = useState('room')
  const [notice,setNotice] = useState('')
  const [quantity,setQuantity] = useState(1)
  const [guest,setGuest] = useState({name:'',email:'',phone:'',arrival:settings.arrivalTime})
  const drag = useRef(null)
  const pending = useRef(null)
  const dates = Array.from({length:14},(_,i)=>add(week,i))
  const room = rooms.find(r=>r.id===selection?.room)
  const nights = selection ? nightsBetween(parse(selection.start),parse(selection.end)) : 0
  const available = (r,date) => Math.max(0,inventoryAt(r,key(date),bookings,cleaning,rooms).remaining)
  const rangeStock = selection && room ? Math.min(...Array.from({length:nights},(_,i)=>available(room,add(parse(selection.start),i)))) : 0
  const total = room ? stayPrice(room,selection.start,selection.end,quantity) : 0
  function selectRange(id,a,b) {
    const start = a<b?a:b, end = a<b?b:a
    const r = rooms.find(item=>item.id===id)
    const count = nightsBetween(parse(start),parse(end)) || 1
    if (Array.from({length:count},(_,i)=>available(r,add(parse(start),i))).some(n=>n<1)) { setNotice('That stay includes a sold-out date. Please select another period.'); return }
    setSelection({room:id,start,end:start===end?key(add(parse(start),1)):end})
    setQuantity(1); setNotice('')
  }
  function begin(id,date,event) {
    if(event.button!==0 || key(date)<key(today)) return
    if(!available(rooms.find(r=>r.id===id),date)) return
    event?.preventDefault()
    drag.current={room:id,start:key(date),end:key(date),moved:false}
    selectRange(id,key(date),key(date))
  }
  function move(id,date) {
    const d=drag.current
    if(!d || d.room!==id || key(date)<key(today)) return
    if(d.end!==key(date)) d.moved=true
    d.end=key(date); selectRange(id,d.start,d.end)
  }
  function finish() {
    const d=drag.current
    if(!d) return
    if(d.moved) { pending.current=null;setSummaryReady(true) }
    else if(pending.current?.room===d.room && pending.current.start!==d.start) { selectRange(d.room,pending.current.start,d.start); pending.current=null;setSummaryReady(true) }
    else pending.current={room:d.room,start:d.start}
    drag.current=null
  }
  useEffect(() => {
    window.addEventListener('pointerup', finish)
    window.addEventListener('blur', finish)
    return () => { window.removeEventListener('pointerup', finish); window.removeEventListener('blur', finish) }
  })
  function changeDate(field,value) {
    if(!value || !selection) return
    const next={...selection,[field]:value}
    if(next.start<key(today) || next.end<=next.start) {setNotice('Check-out must be after check-in, and check-in cannot be in the past.');return}
    selectRange(next.room,next.start,next.end)
  }
  function save(event) {
    event?.preventDefault()
    if(!room||!isBookable(room)){setNotice('This room type is not published. Choose another room.');setBookingStep('room');return}
    if(quantity>rangeStock || quantity<1) {setNotice('There are not enough rooms for this stay.');return}
    const next=[...bookings,{...selection,quantity,total,guest:{...guest},id:crypto.randomUUID()}]
    try {localStorage.setItem('miri-bookings',JSON.stringify(next))} catch {setNotice('Unable to save in this browser. Please enable local storage.');return}
    setBookings(next);setBookingStep('room');setSelection(null);pending.current=null;setGuest({name:'',email:'',phone:'',arrival:settings.arrivalTime});setNotice('Reservation saved. Room availability has been updated.')
  }
  return <div className={`app ${sidebarOpen?'nav-open':'nav-closed'}`} onPointerUp={finish} onPointerCancel={()=>{drag.current=null}}>
    {mobileNav&&sidebarOpen&&<button className="nav-backdrop" tabIndex={-1} aria-hidden="true" onClick={()=>setSidebarOpen(false)}/>}<aside id="fds-navigation" ref={sidebarRef} className="sidebar" role={mobileNav&&sidebarOpen?'dialog':undefined} aria-modal={mobileNav&&sidebarOpen?true:undefined} aria-label="Main menu">{mobileNav&&<button className="nav-close" aria-label="Close menu" onClick={()=>setSidebarOpen(false)}>×</button>}<div className="brand">{settings.logoDataUrl?<img className="sidebar-logo" src={settings.logoDataUrl} alt={`${settings.propertyName} logo`}/>:<span className="brand-icon">M</span>}<div>MIRI<span>PROPERTY OPERATIONS</span></div></div><nav>{['Dashboard','Reservations','Booking','Room Planner','Housekeeping','Folio & Billing','Guests','Reports','Settings','Staff','Profile'].filter(item=>item!=='Staff'||canManageStaff).map((item,i)=><button key={item} className={page===item?'active':''} onClick={()=>{setPage(item);if(mobileNav)setSidebarOpen(false)}}><span>{['◫','▤','+','▦','◇','¤','◎','▥','⚙','▤','◎'][i]}</span>{item}</button>)}</nav><div className="hotel"><strong>{settings.propertyName}</strong><span>Front desk workspace</span><div className="online">● Staff online</div></div></aside>
    <div className="workspace" inert={mobileNav&&sidebarOpen?true:undefined}>{pagePending&&<div className="navigation-progress" role="status"><span className="sr-only">Opening page…</span></div>}<header><div className="header-leading"><button ref={menuToggle} className="menu-toggle" aria-label={sidebarOpen?'Collapse menu':'Expand menu'} aria-expanded={sidebarOpen} aria-controls="fds-navigation" onClick={()=>setSidebarOpen(open=>!open)}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><div><span className="eyebrow">FRONT DESK / RESERVATIONS</span><h1>{page==='Booking'?(bookingStep==='room'?'New Reservation':bookingStep==='details'?'Booking / Guest Details':'Booking / Review & Confirm'):page}</h1></div></div><div className="staff"><span className="avatar">FD</span><div><strong>{user.name}</strong><small>{roleLabels[user.role]}{demoMode?' (Demo)':''} · {settings.propertyName}</small><button className="sign-out" onClick={()=>onSignOut().catch(error=>setNotice(error.message))}>Sign Out</button></div></div></header>
    <main key={page} className="page-content" aria-busy={pagePending}>{notice && <div className="notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss notification">×</button></div>}
    {page==='Staff'? <StaffManagement user={user} onUserUpdate={onUserUpdate}/> : page==='Guests'? <Guests user={user} onDelete={deleteProfile} bookings={bookings} rooms={rooms} profiles={profiles} onSave={next=>saveLocal('miri-guests',next,setProfiles)} onNewBooking={profile=>{const {stays:_stays,id:_id,...details}=profile;setGuest({...details,arrival:settings.arrivalTime});setSelection(null);pending.current=null;setPage('Booking');setBookingStep('room')}} /> : page==='Reports'? <Reports bookings={bookings} rooms={rooms} today={key(today)} money={money}/> : page==='Settings'? <Settings user={user} onRoomsSave={next=>saveLocal('miri-rooms',next,setRooms)} today={key(today)} settings={settings} onSave={next=>{if(!['admin','manager'].includes(user.role)&&(next.logoDataUrl||'')!==(settings.logoDataUrl||''))return false;return saveLocal('miri-settings',next,setSettings)}} rooms={rooms} bookings={bookings} onNavigate={setPage}/> : page==='Folio & Billing'? <Billing rooms={rooms} property={settings} bookings={bookings} money={money} updateBookings={next=>{try{localStorage.setItem('miri-bookings',JSON.stringify(next));setBookings(next);return true}catch{setNotice('Unable to save folio changes.');return false}}} /> : ['Dashboard','Reservations','Room Planner','Housekeeping'].includes(page) ? <Operations user={user} onRoomsSave={next=>saveLocal('miri-rooms',next,setRooms)} property={settings} key={page} page={page} bookings={bookings} rooms={rooms} today={today} dateKey={key} add={add} parse={parse} pretty={pretty} money={money} updateBookings={next=>{try{localStorage.setItem('miri-bookings',JSON.stringify(next));setBookings(next);return true}catch{setNotice('Unable to save changes in this browser.');return false}}} newBooking={()=>{setPage('Booking');setBookingStep('room')}} /> : page==='Booking' && bookingStep!=='room' && selection ? <GuestDetails bookings={bookings} profiles={profiles} propertyName={settings.propertyName} city={settings.city} room={room} selection={selection} nights={nights} quantity={quantity} total={total} guest={guest} setGuest={setGuest} step={bookingStep} onBack={setBookingStep} onReview={()=>setBookingStep('review')} onConfirm={save} money={money} pretty={pretty} parse={parse} /> : page==='Booking'? <div className={`booking-layout booking-calendar-layout ${selection&&summaryReady?'has-selection':'calendar-only'}`}>{selection&&summaryReady&&<section className="summary card"><h2>Booking Summary</h2><div className="summary-body"><span className="eyebrow">SELECTED STAY</span><h3>{room?.name || 'Choose your room'}</h3>{room && <span className="badge">{room.note}</span>}<label>Check-in<input type="date" min={key(today)} value={selection?.start||''} disabled={!selection} onChange={e=>changeDate('start',e.target.value)}/></label><label>Check-out<input type="date" min={selection?key(add(parse(selection.start),1)):key(add(today,1))} value={selection?.end||''} disabled={!selection} onChange={e=>changeDate('end',e.target.value)}/></label><p className="muted">{selection?`${nights} night${nights===1?'':'s'} · up to ${room.guests*quantity} guests`:'Select dates on the calendar to begin.'}</p><label className="room-count">Rooms<select disabled={!selection} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}>{Array.from({length:Math.max(1,rangeStock)},(_,i)=><option key={i} value={i+1}>{i+1} room{i?'s':''}</option>)}</select></label><div className="total"><span className="eyebrow">GRAND TOTAL</span><strong>{money(receiptCharges(Math.round(total*100)).total/100)}</strong><small>{selection?'Includes SST 6% and Service Charges 10%':'Your stay total will appear here'}</small></div></div><button className="primary" disabled={!selection || quantity>rangeStock} onClick={()=>{pending.current=null;setBookingStep('details')}}>Continue to Guest Details <span>→</span></button><button className="secondary" onClick={()=>{setSelection(null);setSummaryReady(false);pending.current=null;setNotice('')}}>Clear Selection</button><div className="tip"><strong>Front Desk Booking</strong><p>Select a room and stay dates, then add your guest details.</p></div></section>}
    <section className="availability card"><div className="section-title"><div><h2>Room Availability & Rates</h2><p className="muted">Find the right room for every stay.</p></div><span className="live">● Live calendar</span></div><div className="controls"><label>Calendar starts<input type="date" value={key(week)} onChange={e=>e.target.value&&setWeek(parse(e.target.value))}/></label><label>Room type<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">No preference</option>{rooms.filter(isBookable).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><div className="week-buttons"><button className="secondary" onClick={()=>setWeek(add(week,-7))}>← Previous</button><button className="secondary" onClick={()=>setWeek(today)}>Today</button><button className="secondary" onClick={()=>setWeek(add(week,7))}>Next Week →</button></div></div><div className="calendar-help"><strong>Click or drag across dates to select your stay.</strong><span>Click check-in, then check-out. Drag from check-in to check-out. Check-out is excluded.</span></div><div className="table-scroll"><table className="calendar"><thead><tr><th className="room-heading">ROOM TYPE / DATE<small>Rate per night · Max guests</small></th>{dates.map(d=><th key={key(d)} className={key(d)===key(today)?'today':''}><span>{d.toLocaleDateString('en-GB',{weekday:'short'})}</span><strong>{d.getDate().toString().padStart(2,'0')}</strong><small>{d.toLocaleDateString('en-GB',{month:'short',year:'numeric'})}</small>{key(d)===key(today)&&<i/>}</th>)}</tr></thead><tbody>{rooms.filter(r=>isBookable(r)&&(filter==='all'||r.id===filter)).map(r=><tr key={r.id}><th className={selection?.room===r.id?'chosen-room':''}><strong>{r.name}</strong><small>{r.note} · {r.guests} guests</small></th>{dates.map(d=>{const date=key(d), stock=available(r,d), selected=selection?.room===r.id&&date>=selection.start&&date<selection.end, checkout=selection?.room===r.id&&date===selection.end, past=date<key(today);return <td key={date} className={`${selected?'selected':''} ${checkout?'checkout':''} ${past?'past':''}`}><button disabled={past||stock<1} aria-label={`${r.name}, ${pretty(d)}, ${money(nightlyRate(r,date))}, ${stock} rooms available${selected?', selected':''}${checkout?', check-out':''}`} aria-pressed={selected} onPointerDown={e=>begin(r.id,d,e)} onPointerEnter={()=>move(r.id,d)} onClick={e=>{if(e.detail===0){ if(pending.current?.room===r.id){selectRange(r.id,pending.current.start,date);pending.current=null;setSummaryReady(true)}else{selectRange(r.id,date,date);pending.current={room:r.id,start:date}}}}}><span>{stock>0?nightlyRate(r,date).toFixed(2):'N/A'}</span><small className={stock<1?'sold':''}>{past?'Past date':stock>0?`${stock} left`:'Sold out'}</small>{checkout&&<em>OUT</em>}</button></td>})}</tr>)}</tbody></table></div><div className="calendar-footer"><span>{selection?`Selected ${pretty(parse(selection.start))} – ${pretty(parse(selection.end))}: ${nights} nights (check-out excluded)`:'All prices in MYR · Approved rates'}</span><div><i/> Selected nights <b/> Check-out</div></div></section></div>:
    <Profile user={user} property={settings} onNavigate={setPage}/>}
    <footer>Demo workspace · Sample room rates · Reservations saved in this browser only</footer></main></div>
  </div>
}






