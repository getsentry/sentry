import {render} from 'react-dom';

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

  render(<Component {...props} />, rootEl);
}
