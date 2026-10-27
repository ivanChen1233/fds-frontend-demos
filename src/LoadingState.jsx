export default function LoadingState({label='Loading…',rows=4}){
 return <div className="loading-state" role="status" aria-live="polite"><span className="loading-label"><i className="loading-spinner" aria-hidden="true"/>{label}</span><div className="skeleton-list" aria-hidden="true">{Array.from({length:rows},(_,i)=><div className="skeleton-row" key={i}><span/><span/><span/></div>)}</div></div>
}
