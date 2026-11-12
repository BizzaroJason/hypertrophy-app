import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { ensureReady } from './db/db';
import './styles.css';

registerSW({ immediate: true });

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');

ensureReady()
  .then(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    root.textContent = error instanceof Error ? error.message : 'Kiln could not open its local database.';
  });
