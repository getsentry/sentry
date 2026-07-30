import type React from 'react';
import {createRoot} from 'react-dom/client';

export function renderDom<T extends React.ComponentType<any>>(
  Component: T,
  container: string,
  props: React.ComponentProps<T>
) {
  const rootEl = document.querySelector(container);

  // Note: On pages like `SetupWizard`, we will attempt to mount main App
  // but will fail because the DOM el wasn't found (which is intentional)
  if (!rootEl) {
    return;
  }

  const root = createRoot(rootEl);
  root.render(<Component {...props} />);
}
