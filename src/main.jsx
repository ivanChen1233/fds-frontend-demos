import AuthGate from './AuthGate'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>{(user,onSignOut,onUserUpdate)=><App user={user} onSignOut={onSignOut} onUserUpdate={onUserUpdate}/>}</AuthGate>
  </StrictMode>,
)
