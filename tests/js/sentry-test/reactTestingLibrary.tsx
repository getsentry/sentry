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
import {DANGEROUS_SET_TEST_HISTORY} from 'sentry/utils/browserHistory';
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

type RouterConfig = {
  location: InitialEntry;
};

type RenderOptions<T extends boolean = false> = T extends true
  ? BaseRenderOptions<T> & {initialRouterConfig?: RouterConfig}
  : BaseRenderOptions<T>;

type RenderReturn<T extends boolean = boolean> = T extends true
  ? rtl.RenderResult & {router: TestRouter}
  : rtl.RenderResult;

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

    const history = options.history ?? createMemoryHistory();

    // Inject legacy react-router 3 style router mocked navigation functions
    // into the memory history used in react router 6
    //
    // TODO(epurkhiser): In a world without react-router 3 we should figure out
    // how to write our tests in a simpler way without all these shims
    if (!options.disableRouterMocks) {
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
    }

    DANGEROUS_SET_TEST_HISTORY({
      goBack: router.goBack,
      push: router.push,
      replace: router.replace,
      listen: jest.fn(() => {}),
      listenBefore: jest.fn(),
      getCurrentLocation: jest.fn(() => ({pathname: '', query: {}})),
    });

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

function makeRouter({
  children,
  history,
}: {
  history: MemoryHistory;
  children?: React.ReactNode;
}) {
  // By default react-router 6 catches exceptions and displays the stack
  // trace. For tests we want them to bubble out
  function ErrorBoundary(): React.ReactNode {
    throw useRouteError();
  }

  const routes: RouteObject[] = [
    {
      path: '*',
      element: children,
      errorElement: <ErrorBoundary />,
    },
  ];

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
    return this.router.state.location;
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
      ? options.initialRouterConfig?.location
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
  });

  const renderResult = rtl.render(<RouterProvider router={memoryRouter} />, options);

  const rerender = (newUi: React.ReactElement) => {
    const newRouter = makeRouter({
      children: <AllTheProviders>{newUi}</AllTheProviders>,
      history,
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
