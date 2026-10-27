const clone = value => JSON.parse(JSON.stringify(value))
const amount = value => /^\d+(\.\d{1,2})?$/.test(String(value)) && Number(value)>0 && Number(value)<=1000000
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value||'') && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value
export function pricingOf(room){return clone(room.pricing||{baseRate:room.rate,remark:'',rules:[]})}
export function validatePricing(input){
 if(!amount(input.baseRate))throw new Error('Enter a positive Base Rate with up to two decimal places.')
 const rules=input.rules||[]
 for(const rule of rules){
  if(!amount(rule.rate)||!Number.isInteger(Number(rule.prior))||Number(rule.prior)<1||!rule.remark?.trim())throw new Error('Every rule requires a positive price, integer Prior and Remark.')
  if(!['Date Range','Selected Day','Specific Date'].includes(rule.type))throw new Error('Choose a valid rule type.')
  if(rule.type==='Date Range'&&(!validDate(rule.start)||!validDate(rule.end)||rule.end<rule.start))throw new Error('Enter a valid date range. Both dates are included.')
  if(rule.type==='Selected Day'&&(!rule.days?.length||rule.days.some(day=>!Number.isInteger(Number(day))||Number(day)<0||Number(day)>6)))throw new Error('Select at least one weekday.')
  if(rule.type==='Specific Date'&&(!rule.dates?.length||rule.dates.some(date=>!validDate(date))))throw new Error('Enter valid specific dates.')
 }
 if(new Set(rules.map(r=>Number(r.prior))).size!==rules.length)throw new Error('Use a unique Prior for each rule to avoid ambiguous prices.')
 return {baseRate:Number(input.baseRate),remark:(input.remark||'').trim(),rules:rules.map(r=>({...clone(r),rate:Number(r.rate),prior:Number(r.prior)}))}
}
export function nightlyRate(room,date){
 const pricing=pricingOf(room),weekday=new Date(date+'T12:00:00Z').getUTCDay()
 const matching=pricing.rules.filter(r=>r.type==='Date Range'?r.start<=date&&date<=r.end:r.type==='Selected Day'?r.days.map(Number).includes(weekday):r.dates.includes(date)).sort((a,b)=>b.prior-a.prior)
 return matching[0]?.rate??pricing.baseRate
}
export function stayPrice(room,start,end,quantity=1){
 let cents=0
 for(let date=start;date<end;date=new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10))cents+=Math.round(nightlyRate(room,date)*100)*quantity
 return cents/100
}
export function submitPricing(room,input,user,stamp){
 if(!['front_desk','admin','manager'].includes(user?.role))throw new Error('You cannot submit pricing changes.')
 if(room.rateRequest?.status==='Pending Approval'||room.rateDraft?.status==='Pending Approval')throw new Error('This room type already has a pending pricing request.')
 if(room.publication&&room.publication!=='Published')throw new Error('Submit unpublished room type pricing with the room type.')
 return {...room,rateRequest:{pricing:validatePricing(input),previous:pricingOf(room),status:'Pending Approval',submittedBy:user.name,submittedAt:stamp,changeReason:input.changeReason||''}}
}
export function reviewPricing(room,action,reason,user,stamp){
 if(user?.role!=='manager')throw new Error('Only Manager can approve or reject requests.')
 const request=room.rateRequest||(room.rateDraft?.status==='Pending Approval'?{pricing:{baseRate:room.rateDraft.rate,remark:room.rateDraft.reason,rules:[]},previous:{...pricingOf(room),baseRate:room.rateDraft.baseRate},status:'Pending Approval'}:null)
 if(!request||request.status!=='Pending Approval')throw new Error('No pending pricing request.')
 if(!['approve','reject'].includes(action))throw new Error('Invalid review action.')
 if(action==='reject'&&!reason?.trim())throw new Error('A rejection remark is required.')
 if(action==='approve'&&JSON.stringify(request.previous)!==JSON.stringify(pricingOf(room)))throw new Error('Published pricing changed. Please submit a fresh request.')
 const pricing=validatePricing(request.pricing)
 return {...room,...(action==='approve'?{pricing,rate:pricing.baseRate}:{}),rateRequest:null,rateDraft:null,rateHistory:[...(room.rateHistory||[]),{...request,status:action==='approve'?'Published':'Rejected',reviewedBy:user.name,date:stamp,reason:reason?.trim()||''}]}
}
