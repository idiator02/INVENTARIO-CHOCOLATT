import { useEffect, useId, useRef } from 'react';
import Icon from './Icon.jsx';
export default function Modal({ title, onClose, busy, children }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const el = dialog.current;
    el.showModal();
    return () => el.close();
  }, []);
  return <dialog ref={dialog} className="modal" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Cerrar ventana" disabled={busy} onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}
