import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import throttle from 'lodash/throttle';

import {exportedGlobals} from 'sentry/bootstrap/exportGlobals';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import {DocumentTitleManager} from 'sentry/components/sentryDocumentTitle/documentTitleManager';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {ScrapsProviders} from 'sentry/scrapsProviders';
import type {OnSentryInitConfiguration} from 'sentry/types/system';
import {SentryInitRenderReactComponent} from 'sentry/types/system';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';

import {renderDom} from './renderDom';
import {renderOnDomReady} from './renderOnDomReady';

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

const COMPONENT_MAP = {
  [SentryInitRenderReactComponent.INDICATORS]: () =>
    import(/* webpackChunkName: "Indicators" */ 'sentry/components/indicators'),
  [SentryInitRenderReactComponent.SYSTEM_ALERTS]: () =>
    import(/* webpackChunkName: "SystemAlerts" */ 'sentry/views/app/systemAlerts'),
  [SentryInitRenderReactComponent.SETUP_WIZARD]: () =>
    import(/* webpackChunkName: "SetupWizard" */ 'sentry/views/setupWizard'),
  [SentryInitRenderReactComponent.WEB_AUTHN_ASSSERT]: () =>
    import(
      /* webpackChunkName: "WebAuthnAssert" */ 'sentry/components/webAuthn/webAuthnAssert'
    ),
  [SentryInitRenderReactComponent.SU_STAFF_ACCESS_FORM]: () =>
    import(
      /* webpackChunkName: "SuperuserStaffAccessForm" */ 'sentry/components/superuserStaffAccessForm'
    ),
};

interface SimpleRouterProps {
  element: React.ReactNode;
}

function SimpleRouter({element}: SimpleRouterProps) {
  const [router] = useState(() => createBrowserRouter([{path: '*', element}]));

  return <RouterProvider router={router} />;
}

async function processItem(initConfig: OnSentryInitConfiguration) {
  /**
   * Allows our auth pages to dynamically attach a client side password
   * strength indicator The password strength component is very
   * heavyweight as it includes the zxcvbn, a relatively byte-heavy
   * password strength estimation library. Load it on demand.
   */
  if (initConfig.name === 'passwordStrength') {
    if (!initConfig.input || !initConfig.element) {
      return;
    }
    const inputElem = document.querySelector(initConfig.input);
    const rootEl = document.querySelector(initConfig.element);

    if (!inputElem || !rootEl) {
      return;
    }

    const {PasswordStrength} = await import(
      /* webpackChunkName: "PasswordStrength" */ 'sentry/components/passwordStrength'
    );

    const root = createRoot(rootEl);
    inputElem.addEventListener(
      'input',
      throttle(e => {
        root.render(
          /**
           * The screens and components rendering here will always render in light mode.
           * This is because config is not available at this point (user might not be logged in yet),
           * and so we dont know which theme to pick.
           */
          <QueryClientProvider client={queryClient}>
            <ThemeAndStyleProvider>
              <PasswordStrength value={e.target.value} />
            </ThemeAndStyleProvider>
          </QueryClientProvider>
        );
      })
    );

    return;
  }

  /**
   * Allows server rendered templates to render a React component to DOM
   * without exposing the component globally.
   */
  if (initConfig.name === 'renderReact') {
    if (!COMPONENT_MAP.hasOwnProperty(initConfig.component)) {
      return;
    }
    const {default: Component} = await COMPONENT_MAP[initConfig.component]();

    renderOnDomReady(() => {
      // If props are not provided, try to read them from data attributes
      let props = initConfig.props || {};
      if (!initConfig.props && initConfig.container) {
        const containerElement = document.querySelector(initConfig.container);
        if (containerElement) {
          // Read all data-* attributes and parse them as JSON
          Array.from(containerElement.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
              const propName = attr.name
                .slice(5) // Remove 'data-' prefix
                .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); // Convert kebab-case to camelCase
              try {
                props[propName] = JSON.parse(attr.value);
              } catch {
                // If parsing fails, use the raw string value
                props[propName] = attr.value;
              }
            }
          });
        }
      }

      // TODO(ts): Unsure how to type this, complains about u2fsign's required props
      renderDom(
        (p: any) => (
          /**
           * The screens and components rendering here will always render in light mode.
           * This is because config is not available at this point (user might not be logged in yet),
           * and so we dont know which theme to pick.
           */
          <QueryClientProvider client={queryClient}>
            <DocumentTitleManager>
              <ThemeAndStyleProvider>
                <CommandPaletteProvider>
                  <SimpleRouter
                    element={
                      <ScrapsProviders>
                        <Component {...p} />
                      </ScrapsProviders>
                    }
                  />
                </CommandPaletteProvider>
              </ThemeAndStyleProvider>
            </DocumentTitleManager>
          </QueryClientProvider>
        ),
        initConfig.container,
        props
      );
    });
  }

  /**
   * Callback for when js bundle is loaded. Provide library + component references
   * for downstream consumers to use.
   */
  if (initConfig.name === 'onReady' && typeof initConfig.onReady === 'function') {
    initConfig.onReady(exportedGlobals);
  }
}

/**
 * This allows server templates to push "tasks" to be run after application has initialized.
 * The global `window.__onSentryInit` is used for this.
 *
 * Be careful here as we can not guarantee type safety on `__onSentryInit` as
 * these will be defined in server rendered templates
 */
export async function processInitQueue() {
  // Currently, this is run *before* anything is queued in
  // `window.__onSentryInit`. We want to provide a migration path for potential
  // custom plugins that rely on `window.SentryApp` so they can start migrating
  // their plugins ASAP, as `SentryApp` will be loaded async and will require
  // callbacks to access it, instead of via `window` global.
  if (
    typeof window.__onSentryInit !== 'undefined' &&
    !Array.isArray(window.__onSentryInit)
  ) {
    return;
  }

  const queued = window.__onSentryInit;

  // Stub future calls of `window.__onSentryInit.push` so that it is
  // processed immediately (since bundle is loaded at this point and no
  // longer needs to act as a queue)
  //
  window.__onSentryInit = {
    push: processItem,
  };

  if (Array.isArray(queued)) {
    // These are all side-effects, so no need to return a value, but allow consumer to
    // wait for all initialization to finish
    await Promise.all(queued.map(processItem));
  }
}
