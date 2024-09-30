import {type RouteObject, RouterProvider, useRouteError} from 'react-router-dom';
import {cache} from '@emotion/css'; // eslint-disable-line @emotion/no-vanilla
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {createMemoryHistory, createRouter} from '@remix-run/router';
import * as rtl from '@testing-library/react'; // eslint-disable-line no-restricted-imports
import userEvent from '@testing-library/user-event'; // eslint-disable-line no-restricted-imports
import * as qs from 'query-string';

import {makeTestQueryClient} from 'sentry-test/queryClient';

import {GlobalDrawer} from 'sentry/components/globalDrawer';
import GlobalModal from 'sentry/components/globalModal';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {lightTheme} from 'sentry/utils/theme';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

import {instrumentUserEvent} from '../instrumentedEnv/userEventIntegration';

import {initializeOrg} from './initializeOrg';

interface ProviderOptions {
  /**
   * Sets the OrganizationContext. You may pass null to provide no organization
   */
  organization?: Partial<Organization> | null;
  /**
   * Sets the RouterContext
   */
  router?: Partial<InjectedRouter>;
}

interface Options extends ProviderOptions, rtl.RenderOptions {}

function makeAllTheProviders(providers: ProviderOptions) {
  const {organization, router} = initializeOrg({
    organization: providers.organization === null ? undefined : providers.organization,
    router: providers.router,
  });

  // In some cases we may want to not provide an organization at all
  const optionalOrganization = providers.organization === null ? null : organization;

  return function ({children}: {children?: React.ReactNode}) {
    const content = (
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: router.params,
          routes: router.routes,
        }}
      >
        <OrganizationContext.Provider value={optionalOrganization}>
          <GlobalDrawer>{children}</GlobalDrawer>
        </OrganizationContext.Provider>
      </RouteContext.Provider>
    );

    // Inject legacy react-router 3 style router mocked navigation functions
    // into the memory history used in react router 6
    //
    // TODO(epurkhiser): In a world without react-router 3 we should figure out
    // how to write our tests in a simpler way without all these shims

    const history = createMemoryHistory();
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

    // By default react-router 6 catches exceptions and displays the stack
    // trace. For tests we want them to bubble out
    function ErrorBoundary(): React.ReactNode {
      throw useRouteError();
    }

    const routes: RouteObject[] = [
      {
        path: '*',
        element: content,
        errorElement: <ErrorBoundary />,
      },
    ];

    const memoryRouter = createRouter({
      future: {v7_prependBasename: true},
      history,
      routes,
    }).initialize();

    return (
      <CacheProvider value={{...cache, compat: true}}>
        <ThemeProvider theme={lightTheme}>
          <QueryClientProvider client={makeTestQueryClient()}>
            <RouterProvider router={memoryRouter} />
          </QueryClientProvider>
        </ThemeProvider>
      </CacheProvider>
    );
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
 */
function render(
  ui: React.ReactElement,
  {router, organization, ...rtlOptions}: Options = {}
) {
  const AllTheProviders = makeAllTheProviders({
    organization,
    router,
  });

  return rtl.render(ui, {wrapper: AllTheProviders, ...rtlOptions});
}

/**
 * @deprecated
 * Use userEvent over fireEvent where possible.
 * More details: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#not-using-testing-libraryuser-event
 */
const fireEvent = rtl.fireEvent;

function renderGlobalModal(options?: Options) {
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

// eslint-disable-next-line import/export
export {
  render,
  renderGlobalModal,
  userEvent,
  fireEvent,
  waitForDrawerToHide,
  makeAllTheProviders,
};
