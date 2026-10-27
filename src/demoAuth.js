// Synthetic credentials for local UI demonstrations only. Never use for deployment.
export const demoAdmin={id:'demo-admin',name:'Demo Admin',email:'admin@hotel.local',phone:'',role:'admin',status:'active',password:'DemoAdmin123!'}
const visible=user=>{const {password:_password,...details}=user;return details}
const error=(status,message)=>Object.assign(new Error(message),{status})
export function createDemoApi(storage,session){
 const key='miri-demo-accounts',sessionKey='miri-demo-session'
 function accounts(){const raw=storage.getItem(key);if(raw)return JSON.parse(raw);const initial=[{...demoAdmin}];storage.setItem(key,JSON.stringify(initial));return initial}
 return async function demoApi(path,options={}){
  const method=options.method||'GET',body=options.body?JSON.parse(options.body):{}
  let users=accounts()
  const current=users.find(u=>u.id===session.getItem(sessionKey)&&u.status==='active')
  if(path==='/api/auth/setup'&&method==='GET')return {setupRequired:false}
  if(path==='/api/auth/session')return {user:current?visible(current):null}
  if(path==='/api/auth/login'&&method==='POST'){
   const user=users.find(u=>u.email.toLowerCase()===String(body.email||'').trim().toLowerCase()&&u.password===body.password)
   if(!user)throw error(401,'Email or password is incorrect.')
   if(user.status!=='active')throw error(403,'This demo account is disabled.')
   session.setItem(sessionKey,user.id);return {user:visible(user)}
  }
  if(path==='/api/auth/logout'){session.removeItem(sessionKey);return {message:'Signed out.'}}
  if(!current)throw error(401,'Sign in to continue.')
  if(path.startsWith('/api/staff')&&!['admin','manager'].includes(current.role))throw error(403,'Staff Management is limited to admins and managers.')
  if(path==='/api/staff'&&method==='GET')return {users:users.map(visible)}
  if(path.startsWith('/api/staff')&&['POST','PATCH'].includes(method)){
   const target=method==='PATCH'?users.find(u=>u.id===path.split('/').at(-1)):null
   if(method==='PATCH'&&!target)throw error(404,'Staff member not found.')
   if(!body.name?.trim()||!/^\S+@\S+\.\S+$/.test(body.email||'')||!['admin','manager','front_desk'].includes(body.role))throw error(400,'Enter a name, valid email and role.')
   if(current.role==='manager'&&(target?.role==='admin'||body.role==='admin'))throw error(403,'Only admins can manage admin accounts.')
   if(target?.id===current.id&&(body.role!==current.role||body.status!=='active'))throw error(400,'You cannot change your own role or disable your own account.')
   if(method==='POST'&&(!body.password||body.password.length<10))throw error(400,'Use a password of at least 10 characters.')
   if(method==='PATCH'&&!['active','disabled','pending'].includes(body.status))throw error(400,'Choose a valid account status.')
   const email=body.email.trim().toLowerCase();if(users.some(u=>u.email.toLowerCase()===email&&u.id!==target?.id))throw error(409,'Email is already registered.')
   const updated={id:target?.id||crypto.randomUUID(),name:body.name.trim(),email,phone:body.phone||'',role:body.role,status:target?body.status:'active',password:target?target.password:body.password}
   users=target?users.map(u=>u.id===target.id?updated:u):[...users,updated]
   storage.setItem(key,JSON.stringify(users));return {user:visible(updated)}
  }
  throw error(404,'This action is unavailable in demo mode.')
 }
}
