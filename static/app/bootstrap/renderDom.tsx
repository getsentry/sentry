import type React from 'react';
import {createRoot} from 'react-dom/client';

export function renderDom<T extends React.ComponentType<any>>(
  Component: T,
  container: string,
  props: React.ComponentProps<T>
) {
  const rootEl = document.querySelector(container);

  // Django-rendered pages without the app's root element skip mounting
  if (!rootEl) {
    return;
  }

  const root = createRoot(rootEl);
  root.render(<Component {...props} />);
}
