import { Component } from 'react';
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="fatal card"><h1>No se ha podido mostrar la aplicación</h1><p>Recarga la página. Si el problema continúa, revisa los datos del inventario.</p><button className="button primary" onClick={() => location.reload()}>Volver a cargar</button></main>;
    return this.props.children;
  }
}
