import { useState } from 'react'
export default function Accordion({title,subtitle,count,defaultOpen=false,children,className=''}){
 const [open,setOpen]=useState(defaultOpen)
 return <details className={`ui-accordion ${className}`} open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary><span className="accordion-heading"><strong>{title}</strong>{subtitle&&<small>{subtitle}</small>}</span>{count!==undefined&&<span className="accordion-count">{count}</span>}<span className="accordion-chevron" aria-hidden="true">⌄</span></summary><div className="accordion-content">{children}</div></details>
}
