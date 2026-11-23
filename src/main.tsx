import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold">SplitPay Ledger</h1>
      </div>
    </StrictMode>,
  );
}
