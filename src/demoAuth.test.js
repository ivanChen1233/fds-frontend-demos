import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoApi,demoAdmin } from './demoAuth.js'
function memory(){const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}}
const post=body=>({method:'POST',body:JSON.stringify(body)})
test('demo admin signs in without backend or role selection and signs out',async()=>{
 const api=createDemoApi(memory(),memory())
 assert.equal((await api('/api/auth/setup')).setupRequired,false)
 await assert.rejects(api('/api/auth/login',post({email:demoAdmin.email,password:'wrong'})))
 const signed=await api('/api/auth/login',post({email:demoAdmin.email,password:demoAdmin.password}))
 assert.equal(signed.user.role,'admin');assert.equal('password'in signed.user,false)
 assert.equal((await api('/api/auth/session')).user.id,demoAdmin.id)
 await api('/api/auth/logout',post({}));assert.equal((await api('/api/auth/session')).user,null)
})
test('demo staff creation persists locally and front desk cannot manage staff',async()=>{
 const storage=memory(),session=memory(),api=createDemoApi(storage,session)
 await api('/api/auth/login',post(demoAdmin))
 await api('/api/staff',post({name:'Demo Front Desk',email:'staff@hotel.local',phone:'',role:'front_desk',password:'TestStaff123!'}))
 assert.equal((await api('/api/staff')).users.length,2)
 await api('/api/auth/logout',post({}))
 const reload=createDemoApi(storage,session)
 const signed=await reload('/api/auth/login',post({email:'staff@hotel.local',password:'TestStaff123!'}))
 assert.equal(signed.user.role,'front_desk')
 await assert.rejects(reload('/api/staff'),e=>e.status===403)
})
test('disabled demo accounts cannot sign in',async()=>{
 const api=createDemoApi(memory(),memory());await api('/api/auth/login',post(demoAdmin))
 const staff=(await api('/api/staff',post({name:'Demo Staff',email:'disabled@hotel.local',role:'front_desk',password:'TestStaff123!'}))).user
 await api(`/api/staff/${staff.id}`,{method:'PATCH',body:JSON.stringify({...staff,status:'disabled'})})
 await api('/api/auth/logout',post({}))
 await assert.rejects(api('/api/auth/login',post({email:staff.email,password:'TestStaff123!'})),e=>e.status===403)
})
