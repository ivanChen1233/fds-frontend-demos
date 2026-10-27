import { folioTotals, roomsForBooking, stayNights } from './bookingRules'

export async function createPaidFolioPdf(booking, property={}, rooms=[]) {
 const totals=folioTotals(booking)
 if(totals.balance!==0)throw new Error('Only fully paid folios can be downloaded.')
 const {jsPDF}=await import('jspdf')
 const pdf=new jsPDF({unit:'mm',format:'a4',compress:true})
 const ink='#000000'
 const money=cents=>`MYR ${(cents/100).toFixed(2)}`
 const date=value=>value?new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('en-GB'):'Not recorded'
 let y=18
 // Browser fonts preserve multilingual guest names in both preview and exported PDF.
 function text(value,x,top,width=174,size=10,bold=false,color=ink,align='left',maxLines=Infinity){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),scale=3,px=size*96/72,w=width*96/25.4
  ctx.font=`${bold?'bold ':''}${px}px Arial, sans-serif`
  const rows=[];let row=''
  for(const c of String(value??'').replace(/\r/g,'')){if(c==='\n'||(row&&ctx.measureText(row+c).width>w)){rows.push(row);row=c==='\n'?'':c}else row+=c}
  rows.push(row)
  if(rows.length>maxLines){rows.length=maxLines;rows[maxLines-1]=rows[maxLines-1].slice(0,-1)+'…'}
  const step=size*0.44+1.3
  for(let i=0;i<rows.length;i++){
   canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(px*1.5*scale);ctx.scale(scale,scale)
   ctx.font=`${bold?'bold ':''}${px}px Arial, sans-serif`;ctx.fillStyle=color;ctx.textBaseline='top';ctx.textAlign=align
   ctx.fillText(rows[i],align==='right'?w:align==='center'?w/2:0,0)
   pdf.addImage(canvas.toDataURL('image/png'),'PNG',x,top+i*step,width,px*1.5*25.4/96)
  }
  return rows.length*step
 }
 function reserve(height){if(y+height>276){pdf.addPage();y=18}}
 function line(value,size=10,bold=false,color=ink){const h=text(value,18,y,174,size,bold,color);y+=h+1}
 const payments=booking.payments||[],lastPayment=payments.at(-1)
 let logoBottom=18
 if(property.logoDataUrl){
  try{
   const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=property.logoDataUrl})
   const width=Math.min(63,24*img.naturalWidth/img.naturalHeight),height=width*img.naturalHeight/img.naturalWidth
   const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0)
   pdf.addImage(canvas.toDataURL('image/png'),'PNG',192-width,18,width,height);logoBottom=18+height
  }catch{throw new Error('The hotel logo could not be loaded. Please check the uploaded logo in Settings.')}
 }
 line('FROM',11,true)
 y+=text(property.propertyName||'Demo Hotel',18,y,90,13,true)+1
 if(property.address||property.city)y+=text(property.address||property.city,18,y,90,10)+1
 if(property.contactPhone)y+=text(property.contactPhone,18,y,90,9)+1
 const titleY=Math.max(logoBottom+5,39)
 text('RECEIPT',115,titleY,77,29,true,ink,'right')
 y=Math.max(y+10,titleY+18)
 const guestTop=y
 text('TO',18,y,88,11,true);y+=8
 y+=text(booking.guest.name,18,y,88,12)+1
 if(booking.guest.address)y+=text(booking.guest.address,18,y,88,10)+1
 if(booking.guest.email)y+=text(booking.guest.email,18,y,88,9)+1
 let meta=guestTop
 for(const [label,value] of [['Receipt #',lastPayment?.receiptNo||'Not recorded'],['Receipt Date',date(lastPayment?.date)],['Booking #',booking.id]]){
  const height=Math.max(text(label,116,meta,30,9,true),text(value,149,meta,43,9,false,ink,'right'));meta+=height+3
 }
 y=Math.max(y,meta)+5
 const roomName=rooms.find(room=>room.id===booking.room)?.name||booking.roomName||'Room accommodation'
 for(const [label,value] of [['Check-in date',date(booking.start)],['Check-out date',date(booking.end)]]){text(label,18,y,34,10,true);text(value,55,y,65,10);y+=7}
 const assigned=roomsForBooking(booking)
 y+=text(`${booking.quantity||1} room(s)${assigned.length?' / Room '+assigned.join(', '):''}`,18,y,174,9)+6
 function tableHeader(){pdf.setDrawColor('#000000');pdf.setLineWidth(0.35);pdf.rect(18,y,174,9);text('Night',21,y+2,20,9,true);text('Description',43,y+2,74,9,true);text('Unit Price',119,y+2,33,9,true,ink,'right');text('Amount',154,y+2,35,9,true,ink,'right');y+=9}
 reserve(30);tableHeader()
 function tableRow(quantity,description,unit,amount){
  // Measure using the same wrapping logic before drawing on the current page.
  const ctx=document.createElement('canvas').getContext('2d');ctx.font='12px Arial, sans-serif'
  let count=1,row=''
  for(const c of String(description)){if(c==='\n'||(row&&ctx.measureText(row+c).width>74*96/25.4)){count++;row=c==='\n'?'':c}else row+=c}
  const height=Math.max(11,Math.min(2,count)*(9*0.44+1.3)+6)
  if(y+height>272){pdf.addPage();y=18;tableHeader()}
  const top=y+3
  text(String(quantity),21,top,19,9,false,ink,'right');const used=text(description,43,top,74,9,false,ink,'left',2)
  text(unit,119,top,33,9,false,ink,'right');text(money(amount),154,top,35,9,false,ink,'right')
  const h=Math.max(height,used+6);pdf.setDrawColor('#000000');pdf.setLineWidth(0.2);pdf.rect(18,y,174,h);y+=h
 }
 const quantity=Math.max(1,stayNights(booking.start,booking.end)),roomCents=Math.round(booking.total*100)
 tableRow(quantity,`${roomName} / ${booking.quantity||1} room(s) (average nightly total)`,money(Math.round(roomCents/quantity)),roomCents)
 const charges=booking.charges||[]
 const listed=charges.length>3?charges.slice(0,2):charges
 for(const charge of listed)tableRow('—',charge.description,money(charge.amountCents),charge.amountCents)
 if(charges.length>3){const remaining=charges.slice(2),amount=remaining.reduce((sum,charge)=>sum+charge.amountCents,0);tableRow('—',`Other services (${remaining.length} entries; details in guest folio)`,money(amount),amount)}
 y+=8
 reserve(33)
 for(const [label,value,highlight] of [['Subtotal',totals.subtotal,false],['SST (6%)',totals.sst,false],['Service Charges (10%)',totals.service,false],['Total',totals.charges,true]]){
  pdf.setLineWidth(highlight?0.4:0.2);pdf.setDrawColor('#000000');pdf.rect(102,y,90,8);pdf.line(149,y,149,y+8)
  text(label,105,y+1.8,42,9,highlight);text(money(value),152,y+1.8,37,9,highlight,ink,'right');y+=8
 }
 reserve(35)
 y+=4;text('TERMS AND CONDITIONS',18,y,174,10,true);y+=7
 for(const term of ['Payment received for the charges listed on this receipt.','Retain this receipt and quote its number for payment enquiries.','Cancellation and refunds follow the policy agreed at booking.','Additional services after issuance are billed separately.']){y+=text(term,18,y,174,8)+0.5}
 y+=2;text('Thank you for staying with us.',18,y,174,9,true)
 const pages=pdf.getNumberOfPages()
 for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setFontSize(8);pdf.setTextColor(0);pdf.text(`Receipt | Page ${i} of ${pages}`,18,290);pdf.text([property.contactEmail,property.website].filter(Boolean).join(' | '),192,290,{align:'right'})}
 return {blob:pdf.output('blob'),filename:`Receipt-${booking.id.replace(/[^a-z0-9-]/gi,'_')}-Paid.pdf`}
}

