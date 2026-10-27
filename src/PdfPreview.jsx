import { useEffect, useRef, useState } from 'react'

export default function PdfPreview({file,onClose}) {
 const dialog=useRef(null),viewer=useRef(null),downloadLink=useRef(null)
 const [ready,setReady]=useState(false),[error,setError]=useState('')
 useEffect(()=>{
  const objectUrl=URL.createObjectURL(file.blob)
  viewer.current.src=objectUrl
  downloadLink.current.href=objectUrl
  const previousFocus=document.activeElement,previousOverflow=document.body.style.overflow
  document.body.style.overflow='hidden'
  dialog.current.showModal()
  return ()=>{URL.revokeObjectURL(objectUrl);document.body.style.overflow=previousOverflow;previousFocus?.focus()}
 },[file])
 function print(){
  try{viewer.current.contentWindow.focus();viewer.current.contentWindow.print()}
  catch{setError('Please use the print icon in the PDF viewer, or download the PDF to print it.')}
 }
 return <dialog className="folio-pdf-preview" ref={dialog} aria-labelledby="folio-pdf-title" onCancel={event=>{event.preventDefault();onClose()}}>
  <div className="folio-pdf-toolbar"><div><h2 id="folio-pdf-title">PDF Preview</h2><p>{file.filename}</p></div><div className="folio-pdf-actions"><a ref={downloadLink} className="primary" download={file.filename}>Download PDF</a><button className="secondary" disabled={!ready} onClick={print}>Print</button><button className="secondary" onClick={onClose} autoFocus aria-label="Close PDF preview">Close</button></div></div>
  {error&&<p className="notice" role="alert">{error}</p>}
  <iframe ref={viewer} title="Paid folio PDF" onLoad={()=>setReady(true)}/>
 </dialog>
}
