import React from 'react';
import ReactDOM from 'react-dom';

import Indicators from 'app/components/indicators';

export function renderIndicators(container: string, props?: Record<string, any>) {
  const rootEl = document.getElementById(container);

  if (!rootEl) {
    return;
  }

  ReactDOM.render(<Indicators {...props} />, rootEl);
}
