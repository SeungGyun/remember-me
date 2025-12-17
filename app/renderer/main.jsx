import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log('[Renderer] Main script loaded');
window.addEventListener('error', (e) => {
    console.error(`[Renderer Global Error] ${e.message} at ${e.filename}:${e.lineno}`);
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
