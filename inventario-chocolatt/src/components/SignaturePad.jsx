import { useEffect, useRef, useState } from 'react';
export default function SignaturePad({ onChange, disabled }) {
  const canvas = useRef(null), drawing = useRef(false), distance = useRef(0), last = useRef(null);
  const [hasInk, setHasInk] = useState(false);
  function reset() {
    const ctx = canvas.current.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 640, 220);
    distance.current = 0; drawing.current = false; last.current = null;
  }
  useEffect(reset, []);
  function point(event) {
    const rect = canvas.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * 640 / rect.width, y: (event.clientY - rect.top) * 220 / rect.height };
  }
  function move(event) {
    if (!drawing.current || disabled) return;
    const next = point(event), previous = last.current, ctx = canvas.current.getContext('2d');
    ctx.strokeStyle = '#161616'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(next.x, next.y); ctx.stroke();
    distance.current += Math.hypot(next.x - previous.x, next.y - previous.y); last.current = next;
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const valid = distance.current >= 20;
    setHasInk(valid); onChange(valid ? canvas.current.toDataURL('image/png') : '');
  }
  return <div className="signature-pad">
    <p>Firma de quien recibe en la barra:</p>
    <canvas ref={canvas} width="640" height="220" aria-label="Recuadro para firmar con el dedo o el ratón" onPointerDown={event => { if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return; event.preventDefault(); canvas.current.setPointerCapture(event.pointerId); drawing.current = true; last.current = point(event); }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
    <div><small>{hasInk ? 'Firma preparada.' : 'Dibuja tu firma en el recuadro.'}</small><button type="button" className="text-button" disabled={disabled} onClick={() => { reset(); setHasInk(false); onChange(''); }}>Borrar firma</button></div>
  </div>;
}
