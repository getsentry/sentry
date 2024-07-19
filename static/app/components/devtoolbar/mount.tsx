import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import App from './components/app';
import Providers from './components/providers';
import type {Configuration} from './types';

export default function mount(rootNode: HTMLElement, config: Configuration) {
  const host = document.createElement('div');
  host.id = config.domId ?? 'sentry-devtools';
  const shadow = host.attachShadow({mode: 'open'});
  const reactRoot = makeReactRoot(shadow, config);

  rootNode.appendChild(host);

  return () => {
    host.remove();
    reactRoot.unmount();
  };
}

function makeReactRoot(shadow: ShadowRoot, config: Configuration) {
  const root = createRoot(shadow);
  root.render(
    <StrictMode>
      <Providers container={shadow} config={config}>
        <App />
      </Providers>
    </StrictMode>
  );
  return root;
}
