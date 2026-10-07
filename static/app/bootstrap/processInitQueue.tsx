import {useState} from 'react';
import {createBrowserRouter} from 'react-router';
import {RouterProvider} from 'react-router/dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {CommandPaletteProvider} from 'sentry/components/commandPalette/ui/cmdk';
import {DocumentTitleManager} from 'sentry/components/sentryDocumentTitle/documentTitleManager';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {ScrapsProviders} from 'sentry/scrapsProviders';
import type {OnSentryInitConfiguration} from 'sentry/types/system';
import {SentryInitRenderReactComponent} from 'sentry/types/system';
import {DEFAULT_QUERY_CLIENT_CONFIG} from 'sentry/utils/queryClient';

import {renderDom} from './renderDom';
import {renderOnDomReady} from './renderOnDomReady';

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

const COMPONENT_MAP = {
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
   * Allows server rendered templates to render a React component to DOM
   * without exposing the component globally.
   */
  if (initConfig.name === 'renderReact') {
    if (!Object.hasOwn(COMPONENT_MAP, initConfig.component)) {
      return;
    }
    const {default: Component} = await COMPONENT_MAP[initConfig.component]();

    renderOnDomReady(() =>
      // TODO(ts): Unsure how to type this, complains about u2fsign's required props
      renderDom(
        (props: any) => (
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
                        <Component {...props} />
                      </ScrapsProviders>
                    }
                  />
                </CommandPaletteProvider>
              </ThemeAndStyleProvider>
            </DocumentTitleManager>
          </QueryClientProvider>
        ),
        initConfig.container,
        initConfig.props
      )
    );
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
  if (window.__onSentryInit !== undefined && !Array.isArray(window.__onSentryInit)) {
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
