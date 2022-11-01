import {Component, Fragment} from 'react';
import {InjectedRouter} from 'react-router';
import {cache} from '@emotion/css'; // eslint-disable-line @emotion/no-vanilla
import {CacheProvider, ThemeProvider} from '@emotion/react';
import * as rtl from '@testing-library/react'; // eslint-disable-line no-restricted-imports
import * as reactHooks from '@testing-library/react-hooks'; // eslint-disable-line no-restricted-imports
import userEvent from '@testing-library/user-event'; // eslint-disable-line no-restricted-imports
import merge from 'lodash/merge';

import GlobalModal from 'sentry/components/globalModal';
import {Organization} from 'sentry/types';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';
import {lightTheme} from 'sentry/utils/theme';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

import {instrumentUserEvent} from '../instrumentedEnv/userEventIntegration';

import {initializeOrg} from './initializeOrg';

type ProviderOptions = {
  context?: Record<string, any>;
  organization?: Partial<Organization>;
  project?: string;
  projects?: string[];
  router?: Partial<InjectedRouter>;
};

type Options = ProviderOptions & rtl.RenderOptions;

const makeQueryClient = () =>
  new QueryClient(
    merge({}, DEFAULT_QUERY_CLIENT_CONFIG, {
      defaultOptions: {
        queries: {
          // Disable retries for tests to allow them to fail fast
          retry: false,
        },
        mutations: {
          // Disable retries for tests to allow them to fail fast
          retry: false,
        },
      },
      // Don't want console output in tests
      logger: {
        log: () => {},
        warn: () => {},
        error: () => {},
      },
    })
  );

function createProvider(contextDefs: Record<string, any>) {
  return class ContextProvider extends Component {
    static childContextTypes = contextDefs.childContextTypes;

    getChildContext() {
      return contextDefs.context;
    }

    render() {
      return this.props.children;
    }
  };
}

function makeAllTheProviders({context, ...initializeOrgOptions}: ProviderOptions) {
  const ContextProvider = context ? createProvider(context) : Fragment;

  const {organization, router} = initializeOrg(initializeOrgOptions as any);

  return function ({children}: {children?: React.ReactNode}) {
    return (
      <ContextProvider>
        <CacheProvider value={{...cache, compat: true}}>
          <ThemeProvider theme={lightTheme}>
            <QueryClientProvider client={makeQueryClient()}>
              <RouteContext.Provider
                value={{
                  router,
                  location: router.location,
                  params: router.params,
                  routes: router.routes,
                }}
              >
                <OrganizationContext.Provider value={organization}>
                  {children}
                </OrganizationContext.Provider>
              </RouteContext.Provider>
            </QueryClientProvider>
          </ThemeProvider>
        </CacheProvider>
      </ContextProvider>
    );
  };
}

/**
 * Migrating from enzyme?
 * Try avoiding unnecessary context and just mount your component. If it works, then you dont need anything else.
 * render(<TestedComponent />);
 *
 * If your component requires routerContext or organization to render, pass it via context options argument.
 * render(<TestedComponent />, {context: routerContext, organization});
 */
function render(ui: React.ReactElement, options?: Options) {
  const {context, organization, project, projects, router, ...otherOptions} =
    options ?? {};

  const AllTheProviders = makeAllTheProviders({
    context,
    organization,
    project,
    projects,
    router,
  });

  return rtl.render(ui, {wrapper: AllTheProviders, ...otherOptions});
}

/**
 * @deprecated
 * Use userEvent over fireEvent where possible.
 * More details: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#not-using-testing-libraryuser-event
 */
const fireEvent = rtl.fireEvent;

function renderGlobalModal(options?: Options) {
  return render(<GlobalModal />, options);
}

/**
 * jest-sentry-environment attaches a global Sentry object that can be used.
 * The types on it conflicts with the existing window.Sentry object so it's using any here.
 */
const globalSentry = (global as any).Sentry;

/**
 * This cannot be implemented as a Sentry Integration because Jest creates an
 * isolated environment for each test suite. This means that if we were to apply
 * the monkey patching ahead of time, it would be shadowed by Jest.
 */
instrumentUserEvent(globalSentry?.getCurrentHub.bind(globalSentry));

// eslint-disable-next-line no-restricted-imports, import/export
export * from '@testing-library/react';

// eslint-disable-next-line import/export
export {render, renderGlobalModal, userEvent, reactHooks, fireEvent};
