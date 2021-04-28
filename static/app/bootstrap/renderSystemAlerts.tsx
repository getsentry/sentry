import React from 'react';
import ReactDOM from 'react-dom';

import SystemAlerts from 'app/views/app/systemAlerts';

export function renderSystemAlerts(container: string, props?: Record<string, any>) {
  const rootEl = document.getElementById(container);

  if (!rootEl) {
    return;
  }

  ReactDOM.render(<SystemAlerts {...props} />, rootEl);
}
