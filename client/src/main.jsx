import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main className="app">
      <h1>ELES LMS</h1>
      <p>Learning Management System</p>
      <p className="status">Frontend is connected to the new project foundation.</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
