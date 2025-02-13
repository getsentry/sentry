import {type RouteObject, RouterProvider, type To, useRouteError} from 'react-router-dom';
import {cache} from '@emotion/css'; // eslint-disable-line @emotion/no-vanilla
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {
  createMemoryHistory,
  createRouter,
  type InitialEntry,
  type MemoryHistory,
  type Router,
  type RouterNavigateOptions,
} from '@remix-run/router';
import * as rtl from '@testing-library/react'; // eslint-disable-line no-restricted-imports
import userEvent from '@testing-library/user-event'; // eslint-disable-line no-restricted-imports
import * as qs from 'query-string';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {makeTestQueryClient} from 'sentry-test/queryClient';

import {GlobalDrawer} from 'sentry/components/globalDrawer';
import GlobalModal from 'sentry/components/globalModal';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {
  DANGEROUS_SET_REACT_ROUTER_6_HISTORY,
  DANGEROUS_SET_TEST_HISTORY,
} from 'sentry/utils/browserHistory';
import {ProvideAriaRouter} from 'sentry/utils/provideAriaRouter';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {lightTheme} from 'sentry/utils/theme';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {TestRouteContext} from 'sentry/views/routeContext';

import {instrumentUserEvent} from '../instrumentedEnv/userEventIntegration';

import {initializeOrg} from './initializeOrg';

interface ProviderOptions {
  /**
   * Do not shim the router use{Routes,Router,Navigate,Location} functions, and
   * instead allow them to work as normal, rendering inside of a memory router.
   *
   * When enabling this passing a `router` object *will do nothing*!
   */
  disableRouterMocks?: boolean;
  /**
   * Sets the history for the router.
   */
  history?: MemoryHistory;
  /**
   * Sets the OrganizationContext. You may pass null to provide no organization
   */
  organization?: Partial<Organization> | null;
  /**
   * Sets the RouterContext.
   */
  router?: Partial<InjectedRouter>;
}

interface BaseRenderOptions<T extends boolean = boolean>
  extends Omit<ProviderOptions, 'history' | 'disableRouterMocks'>,
    rtl.RenderOptions {
  disableRouterMocks?: T;
}

type LocationConfig =
  | string
  | {pathname: string; query?: Record<string, string | number | string[]>};

type RouterConfig = {
  /**
   * Sets the initial location for the router.
   */
  location?: LocationConfig;
  /**
   * Defines a single route for the router. Necessary for testing useParams();
   *
   * Example:
   *
   * route: '/issues/:issueId/'
   */
  route?: string;
  /**
   * Sets the initial routes for the router.
   *
   * Defines multiple valid routes for the router. Necessary for testing
   * useParams() if you have multiple routes that render the same component.
   *
   * Example:
   *
   * routes: ['/issues/:issueId/', '/issues/:issueId/events/:eventId/']
   */
  routes?: string[];
};

type RenderOptions<T extends boolean = false> = T extends true
  ? BaseRenderOptions<T> & {initialRouterConfig?: RouterConfig}
  : BaseRenderOptions<T>;

type RenderReturn<T extends boolean = boolean> = T extends true
  ? rtl.RenderResult & {router: TestRouter}
  : rtl.RenderResult;

// Inject legacy react-router 3 style router mocked navigation functions
// into the memory history used in react router 6
function patchBrowserHistoryMocksEnabled(
  history: MemoryHistory,
  router: InjectedRouter<Record<string, string>, any>
) {
  Object.defineProperty(history, 'location', {get: () => router.location});
  history.replace = router.replace;
  history.push = (path: any) => {
    if (typeof path === 'object' && path.search) {
      path.query = qs.parse(path.search);
      delete path.search;
      delete path.hash;
      delete path.state;
      delete path.key;
    }

    // XXX(epurkhiser): This is a hack for react-router 3 to 6. react-router
    // 6 will not convert objects into strings before pushing. We can detect
    // this by looking for an empty hash, which we normally do not set for
    // our browserHistory.push calls
    if (typeof path === 'object' && path.hash === '') {
      const queryString = path.query ? qs.stringify(path.query) : null;
      path = `${path.pathname}${queryString ? `?${queryString}` : ''}`;
    }

    router.push(path);
  };

  DANGEROUS_SET_TEST_HISTORY({
    goBack: router.goBack,
    push: router.push,
    replace: router.replace,
    listen: jest.fn(() => {}),
    listenBefore: jest.fn(),
    getCurrentLocation: jest.fn(() => ({pathname: '', query: {}})),
  });
}

function makeAllTheProviders(options: ProviderOptions) {
  const {organization, router} = initializeOrg({
    organization: options.organization === null ? undefined : options.organization,
    router: options.router,
  });

  // In some cases we may want to not provide an organization at all
  const optionalOrganization = options.organization === null ? null : organization;

  return function ({children}: {children?: React.ReactNode}) {
    const content = (
      <OrganizationContext.Provider value={optionalOrganization}>
        <GlobalDrawer>{children}</GlobalDrawer>
      </OrganizationContext.Provider>
    );

    const wrappedContent = options.disableRouterMocks ? (
      content
    ) : (
      <TestRouteContext.Provider
        value={{
          router,
          location: router.location,
          params: router.params,
          routes: router.routes,
        }}
      >
        {/* ProvideAriaRouter may not be necessary in tests but matches routes.tsx */}
        <ProvideAriaRouter>{content}</ProvideAriaRouter>
      </TestRouteContext.Provider>
    );

    if (!options.disableRouterMocks) {
      patchBrowserHistoryMocksEnabled(options.history ?? createMemoryHistory(), router);
    }

    return (
      <CacheProvider value={{...cache, compat: true}}>
        <ThemeProvider theme={lightTheme}>
          <QueryClientProvider client={makeTestQueryClient()}>
            {wrappedContent}
          </QueryClientProvider>
        </ThemeProvider>
      </CacheProvider>
    );
  };
}

function createRoutesFromConfig(
  children: React.ReactNode,
  config: RouterConfig | undefined
): RouteObject[] {
  // By default react-router 6 catches exceptions and displays the stack
  // trace. For tests we want them to bubble out
  function ErrorBoundary(): React.ReactNode {
    throw useRouteError();
  }

  const fallbackRoute = {path: '*', element: children, errorElement: <ErrorBoundary />};

  if (config?.route) {
    return [
      {path: config.route, element: children, errorElement: <ErrorBoundary />},
      fallbackRoute,
    ];
  }

  if (config?.routes) {
    return [
      ...config.routes.map(route => ({
        path: route,
        element: children,
        errorElement: <ErrorBoundary />,
      })),
      fallbackRoute,
    ];
  }

  return [{path: '*', element: children, errorElement: <ErrorBoundary />}];
}

function makeRouter({
  children,
  history,
  config,
}: {
  children: React.ReactNode;
  config: RouterConfig | undefined;
  history: MemoryHistory;
}) {
  const routes = createRoutesFromConfig(children, config);

  const router = createRouter({
    future: {v7_prependBasename: true},
    history,
    routes,
  }).initialize();

  return router;
}

class TestRouter {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  get location() {
    // Return parsed query params for convenience
    const query = qs.parse(this.router.state.location.search);

    return {
      ...this.router.state.location,
      query,
    };
  }

  navigate = (to: To | number, opts?: RouterNavigateOptions) => {
    rtl.act(() => {
      if (typeof to === 'number') {
        this.router.navigate(to);
      } else {
        this.router.navigate(to, opts);
      }
    });
  };
}

function parseLocationConfig(location: LocationConfig | undefined): InitialEntry {
  if (!location) {
    return LocationFixture().pathname;
  }

  if (typeof location === 'string') {
    return location;
  }

  if (location.query) {
    const queryString = qs.stringify(location.query);
    return {
      pathname: location.pathname,
      search: queryString ? `?${queryString}` : '',
    };
  }

  return location.pathname;
}

/**
 * Try avoiding unnecessary context and just mount your component. If it works,
 * then you dont need anything else.
 *
 * render(<TestedComponent />);
 *
 * If your component requires additional context you can pass it in the
 * options.
 *
 * To test route changes, pass `disableRouterMocks: true`. This will return a
 * `router` property which can be used to access the location or manually
 * navigate to a route. To set the initial location with mocks disabled,
 * pass an `initialRouterConfig`.
 */
function render<T extends boolean = false>(
  ui: React.ReactElement,
  options: RenderOptions<T> = {} as RenderOptions<T>
): RenderReturn<T> {
  const initialEntry =
    (options.disableRouterMocks
      ? parseLocationConfig(options.initialRouterConfig?.location)
      : options.router?.location?.pathname) ?? LocationFixture().pathname;

  const history = createMemoryHistory({
    initialEntries: [initialEntry],
  });

  const AllTheProviders = makeAllTheProviders({
    organization: options.organization,
    router: options.router,
    disableRouterMocks: options.disableRouterMocks,
    history,
  });

  const memoryRouter = makeRouter({
    children: <AllTheProviders>{ui}</AllTheProviders>,
    history,
    config: options.disableRouterMocks ? options.initialRouterConfig : undefined,
  });

  if (options.disableRouterMocks) {
    DANGEROUS_SET_REACT_ROUTER_6_HISTORY(memoryRouter);
  }

  const renderResult = rtl.render(<RouterProvider router={memoryRouter} />, options);

  const rerender = (newUi: React.ReactElement) => {
    const newRouter = makeRouter({
      children: <AllTheProviders>{newUi}</AllTheProviders>,
      history,
      config: options.disableRouterMocks ? options.initialRouterConfig : undefined,
    });

    renderResult.rerender(<RouterProvider router={newRouter} />);
  };

  const testRouter = new TestRouter(memoryRouter);

  return {
    ...renderResult,
    rerender,
    ...(options.disableRouterMocks ? {router: testRouter} : {}),
  } as RenderReturn<T>;
}

/**
 * @deprecated
 * Use userEvent over fireEvent where possible.
 * More details: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#not-using-testing-libraryuser-event
 */
const fireEvent = rtl.fireEvent;

function renderGlobalModal(options?: BaseRenderOptions) {
  const result = render(<GlobalModal />, options);

  /**
   * Helper that waits for the modal to be removed from the DOM. You may need to
   * wait for the modal to be removed to avoid any act warnings.
   */
  function waitForModalToHide() {
    return rtl.waitFor(() => {
      expect(rtl.screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  }

  return {...result, waitForModalToHide};
}

/**
 * Helper that waits for the drawer to be hidden from the DOM. You may need to
 * wait for the drawer to be removed to avoid any act warnings.
 */
function waitForDrawerToHide(ariaLabel: string) {
  return rtl.waitFor(() => {
    expect(
      rtl.screen.queryByRole('complementary', {name: ariaLabel})
    ).not.toBeInTheDocument();
  });
}

/**
 * This cannot be implemented as a Sentry Integration because Jest creates an
 * isolated environment for each test suite. This means that if we were to apply
 * the monkey patching ahead of time, it would be shadowed by Jest.
 */
instrumentUserEvent();

// eslint-disable-next-line no-restricted-imports, import/export
export * from '@testing-library/react';

export {
  // eslint-disable-next-line import/export
  render,
  renderGlobalModal,
  userEvent,
  // eslint-disable-next-line import/export
  fireEvent,
  waitForDrawerToHide,
  makeAllTheProviders,
};
