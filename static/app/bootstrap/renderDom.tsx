import {render} from 'react-dom';
import {createRoot} from 'react-dom/client';

import {USE_REACT_CONCURRENT_MODE} from 'sentry/constants';

export function renderDom(
  Component: React.ComponentType,
  container: string,
  props: Record<string, any> = {}
) {
  const rootEl = document.querySelector(container);

  // Note: On pages like `SetupWizard`, we will attempt to mount main App
  // but will fail because the DOM el wasn't found (which is intentional)
  if (!rootEl) {
    return;
  }

  // Types are for ConfigStore, the window object is from json and features is not a Set
  if (
    (window.__initialData.features as unknown as string[]).includes(
      'organizations:react-concurrent-renderer-enabled'
    ) ||
    USE_REACT_CONCURRENT_MODE
  ) {
    // Enable concurrent rendering
    const root = createRoot(rootEl);
    root.render(<Component {...props} />);
  } else {
    // Legacy rendering
    render(<Component {...props} />, rootEl);
  }
}
