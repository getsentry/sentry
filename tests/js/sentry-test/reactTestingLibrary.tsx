import {Fragment} from 'react';
import {
  Outlet,
  RouterProvider,
  useRouteError,
  type RouteObject,
  type To,
} from 'react-router-dom';
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
import {userEvent} from '@testing-library/user-event'; // eslint-disable-line no-restricted-imports

import * as qs from 'query-string';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {ThemeFixture} from 'sentry-fixture/theme';

import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import {GlobalDrawer} from 'sentry/components/globalDrawer';
import {GlobalModal} from 'sentry/components/globalModal';
import type {Organization} from 'sentry/types/organization';
import {DANGEROUS_SET_REACT_ROUTER_6_HISTORY} from 'sentry/utils/browserHistory';
import {ProvideAriaRouter} from 'sentry/utils/provideAriaRouter';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {instrumentUserEvent} from '../instrumentedEnv/userEventIntegration';

import {initializeOrg} from './initializeOrg';
import {SentryNuqsTestingAdapter} from './nuqsTestingAdapter';
import {makeTestQueryClient} from './queryClient';
import {ScrapsTestingProviders} from './scrapsTestingProviders';

interface ProviderOptions {
  /**
   * Pass additional context providers
   */
  additionalWrapper?: rtl.RenderOptions['wrapper'];
  /**
   * Sets the OrganizationContext. You may pass null to provide no organization
   */
  organization?: Partial<Organization> | null;
}

interface LocationConfig {
  pathname: string;
  query?: Record<string, string | number | string[]>;
  state?: any;
}

export interface RouterConfig {
  /**
   * Child routes
   */
  children?: RouteObject[];

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
}

interface RenderOptions extends rtl.RenderOptions, ProviderOptions {
  initialRouterConfig?: RouterConfig;
  outletContext?: Record<string, unknown>;
}

interface RenderReturn extends rtl.RenderResult {
  router: TestRouter;
}

interface RenderHookWithProvidersOptions<Props>
  extends Omit<rtl.RenderHookOptions<Props>, 'wrapper'>, ProviderOptions {
  initialRouterConfig?: RouterConfig;
  outletContext?: Record<string, unknown>;
}

interface InitialRouterOptions {
  initialRouterConfig?: RouterConfig;
  outletContext?: Record<string, unknown>;
}

function makeAllTheProviders(options: ProviderOptions) {
  const {organization} = initializeOrg({
    organization: options.organization === null ? undefined : options.organization,
  });

  // In some cases we may want to not provide an organization at all
  const optionalOrganization = options.organization === null ? null : organization;
  // Any additional test providers
  const AdditionalWrapper = options.additionalWrapper ?? Fragment;

  return function ({children}: {children?: React.ReactNode}) {
    const content = (
      <OrganizationContext value={optionalOrganization}>
        <GlobalDrawer>
          <AdditionalWrapper>{children}</AdditionalWrapper>
        </GlobalDrawer>
      </OrganizationContext>
    );

    const wrappedContent = <ProvideAriaRouter>{content}</ProvideAriaRouter>;

    return (
      <CacheProvider value={{...cache, compat: true}}>
        <QueryClientProvider client={makeTestQueryClient()}>
          <SentryNuqsTestingAdapter defaultOptions={{shallow: false}}>
            <ScrapsTestingProviders>
              <CommandPaletteProvider>
                <ThemeProvider theme={ThemeFixture()}>{wrappedContent}</ThemeProvider>
              </CommandPaletteProvider>
            </ScrapsTestingProviders>
          </SentryNuqsTestingAdapter>
        </QueryClientProvider>
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

  const emptyRoute = {
    path: '*',
    element: <div>No routes match, check that your location matches your route</div>,
    errorElement: <ErrorBoundary />,
  };

  if (config?.route) {
    return [
      {
        path: config.route,
        element: children,
        errorElement: <ErrorBoundary />,
        children: config.children,
      },
      emptyRoute,
    ];
  }

  if (config?.routes) {
    return [
      ...config.routes.map(route => ({
        path: route,
        element: children,
        errorElement: <ErrorBoundary />,
        children: config.children,
      })),
      emptyRoute,
    ];
  }

  return [{path: '*', element: children, errorElement: <ErrorBoundary />}];
}

function makeRouter({
  children,
  history,
  config,
  outletContext,
}: {
  children: React.ReactNode;
  config: RouterConfig | undefined;
  history: MemoryHistory;
  outletContext: Record<string, unknown> | undefined;
}) {
  const childRoutes = createRoutesFromConfig(children, config);
  const routes = outletContext
    ? [
        {
          path: '/',
          element: <Outlet context={outletContext} />,
          children: childRoutes,
        },
      ]
    : childRoutes;

  const router = createRouter({
    future: {
      v7_prependBasename: true,
      v7_relativeSplatPath: true,
    },
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

  if (!location.query && !location.state) {
    return location.pathname;
  }

  const config: InitialEntry = {
    pathname: location.pathname,
  };

  if (location.query) {
    config.search = parseQueryString(location.query);
  }

  if (location.state) {
    config.state = location.state;
  }

  return config;
}

function parseQueryString(query: Record<string, string | number | string[]> | undefined) {
  if (!query) {
    return '';
  }
  const queryString = qs.stringify(query);
  return queryString ? `?${queryString}` : '';
}

function getInitialRouterConfig(options: InitialRouterOptions): {
  config: RouterConfig | undefined;
  initialEntry: InitialEntry;
  outletContext: Record<string, unknown> | undefined;
} {
  return {
    initialEntry: parseLocationConfig(options.initialRouterConfig?.location),
    config: options.initialRouterConfig,
    outletContext: options.outletContext,
  };
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
 * To test route changes, this function returns a `router` you can use to
 * access the location or manually navigate to a route. To set the initial
 * location, pass an `initialRouterConfig`.
 */
function render(ui: React.ReactElement, options: RenderOptions = {}): RenderReturn {
  const {initialEntry, config, outletContext} = getInitialRouterConfig(options);

  const history = createMemoryHistory({
    initialEntries: [initialEntry],
  });

  const AllTheProviders = makeAllTheProviders({
    organization: options.organization,
    additionalWrapper: options.additionalWrapper,
  });

  const memoryRouter = makeRouter({
    children: <AllTheProviders>{ui}</AllTheProviders>,
    history,
    config,
    outletContext,
  });

  DANGEROUS_SET_REACT_ROUTER_6_HISTORY(memoryRouter);

  const renderResult = rtl.render(
    <RouterProvider router={memoryRouter} future={{v7_startTransition: true}} />,
    options
  );

  const rerender = (newUi: React.ReactElement) => {
    const newRouter = makeRouter({
      children: <AllTheProviders>{newUi}</AllTheProviders>,
      history,
      config,
      outletContext,
    });

    renderResult.rerender(
      <RouterProvider router={newRouter} future={{v7_startTransition: true}} />
    );
    // Force the router to update children
    rtl.act(() => newRouter.revalidate());
  };

  const testRouter = new TestRouter(memoryRouter);

  return {
    ...renderResult,
    rerender,
    router: testRouter,
  } as RenderReturn;
}

function renderHookWithProviders<Result = unknown, Props = unknown>(
  callback: (initialProps: Props) => Result,
  options: RenderHookWithProvidersOptions<Props> = {} as RenderHookWithProvidersOptions<Props>
): rtl.RenderHookResult<Result, Props> & {router: TestRouter} {
  const {initialEntry, config, outletContext} = getInitialRouterConfig(options);

  const history = createMemoryHistory({
    initialEntries: [initialEntry],
  });

  const AllTheProviders = makeAllTheProviders({
    organization: options.organization,
    additionalWrapper: options.additionalWrapper,
  });

  let memoryRouter: Router | null = null;

  function Wrapper({children}: {children?: React.ReactNode}) {
    memoryRouter = makeRouter({
      children: <AllTheProviders>{children}</AllTheProviders>,
      history,
      config,
      outletContext,
    });

    DANGEROUS_SET_REACT_ROUTER_6_HISTORY(memoryRouter);

    return <RouterProvider router={memoryRouter} future={{v7_startTransition: true}} />;
  }

  const {initialProps, ...rest} = options;

  const hookResult = rtl.renderHook(callback as (initialProps: Props) => Result, {
    ...(rest as Omit<rtl.RenderHookOptions<Props>, 'wrapper'>),
    initialProps,
    wrapper: Wrapper,
  });

  if (!memoryRouter) {
    throw new Error('renderHookWithProviders failed to initialize router');
  }
  const testRouter = new TestRouter(memoryRouter);

  return {
    ...hookResult,
    router: testRouter,
  };
}

/**
 * @deprecated
 * Use userEvent over fireEvent where possible.
 * More details: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#not-using-testing-libraryuser-event
 */
const fireEvent = rtl.fireEvent;

function renderGlobalModal(options?: RenderOptions) {
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
  fireEvent,
  // eslint-disable-next-line import/export
  render,
  renderGlobalModal,
  renderHookWithProviders,
  userEvent,
  waitForDrawerToHide,
};
