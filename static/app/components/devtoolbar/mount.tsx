import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import App from './components/app';
import Providers from './components/providers';
import type {Configuration} from './types';

export default function mount(rootNode: HTMLElement, config: Configuration) {
  const host = document.createElement('div');
  host.id = config.domId ?? 'sentry-devtools';

  const shadow = host.attachShadow({mode: 'open'});
  const reactContainer = document.createElement('div');
  shadow.appendChild(reactContainer);
  const portalContainer = document.createElement('div');
  shadow.appendChild(portalContainer);

  const reactRoot = makeReactRoot({config, portalContainer, reactContainer});

  rootNode.appendChild(host);
  return () => {
    host.remove();
    reactRoot.unmount();
  };
}

function makeReactRoot({
  config,
  portalContainer,
  reactContainer,
}: {
  config: Configuration;
  portalContainer: Element;
  reactContainer: Element;
}) {
  const root = createRoot(reactContainer);
  root.render(
    <StrictMode>
      <Providers
        reactContainer={reactContainer}
        portalContainer={portalContainer}
        config={config}
      >
        <App />
      </Providers>
    </StrictMode>
  );
  return root;
}
