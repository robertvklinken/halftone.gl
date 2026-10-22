import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// No StrictMode: its double-mount would create two WebGL renderers on one canvas.
createRoot(document.getElementById('root')).render(<App />)
