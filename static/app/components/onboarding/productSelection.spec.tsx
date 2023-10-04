import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  platformProductAvailability,
  ProductSelection,
  ProductSolution,
} from 'sentry/components/onboarding/productSelection';

describe('Onboarding Product Selection', function () {
  const organization = Organization({
    features: ['session-replay', 'performance-view', 'profiling-view'],
  });

  it('renders default state', async function () {
    const {router, routerContext} = initializeOrg({
      router: {
        location: {
          query: {
            product: [
              ProductSolution.PERFORMANCE_MONITORING,
              ProductSolution.SESSION_REPLAY,
            ],
          },
        },
        params: {},
      },
    });

    render(<ProductSelection organization={organization} platform="javascript-react" />, {
      context: routerContext,
    });

    // Introduction
    expect(
      screen.getByText(
        textWithMarkupMatcher(/In this quick guide you’ll use npm or yarn/)
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Prefer to set up Sentry using')).not.toBeInTheDocument();

    // Error monitoring shall be checked and disabled by default
    expect(screen.getByRole('checkbox', {name: 'Error Monitoring'})).toBeChecked();

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(screen.getByRole('checkbox', {name: 'Error Monitoring'}));
    expect(
      await screen.findByText(/Let's admit it, we all have errors/)
    ).toBeInTheDocument();

    // Try to uncheck error monitoring
    await userEvent.click(screen.getByRole('checkbox', {name: 'Error Monitoring'}));
    await waitFor(() => expect(router.push).not.toHaveBeenCalled());

    // Performance monitoring shall be checked and enabled by default
    expect(screen.getByRole('checkbox', {name: 'Performance Monitoring'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Performance Monitoring'})).toBeEnabled();

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(screen.getByRole('checkbox', {name: 'Performance Monitoring'}));
    expect(
      await screen.findByText(/Automatic performance issue detection/)
    ).toBeInTheDocument();

    // Uncheck performance monitoring
    await userEvent.click(screen.getByRole('checkbox', {name: 'Performance Monitoring'}));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: undefined,
        query: {product: [ProductSolution.SESSION_REPLAY]},
      })
    );

    // Session replay shall be checked and enabled by default
    expect(screen.getByRole('checkbox', {name: 'Session Replay'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Session Replay'})).toBeEnabled();

    // Uncheck sesseion replay
    await userEvent.click(screen.getByRole('checkbox', {name: 'Session Replay'}));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: undefined,
        query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
      })
    );

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(screen.getByRole('checkbox', {name: 'Session Replay'}));
    expect(
      await screen.findByText(/Video-like reproductions of user sessions/)
    ).toBeInTheDocument();
  });

  it('renders for Loader Script', async function () {
    const {routerContext} = initializeOrg({
      router: {
        location: {
          query: {
            product: [
              ProductSolution.PERFORMANCE_MONITORING,
              ProductSolution.SESSION_REPLAY,
            ],
          },
        },
        params: {},
      },
    });

    const skipLazyLoader = jest.fn();

    render(
      <ProductSelection
        organization={organization}
        lazyLoader
        skipLazyLoader={skipLazyLoader}
        platform="javascript-react"
      />,
      {
        context: routerContext,
      }
    );

    // Introduction
    expect(
      screen.getByText(
        textWithMarkupMatcher(/In this quick guide you’ll use our Loader Script/)
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(/Prefer to set up Sentry using npm or yarn\?/)
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText('Go here'));

    expect(skipLazyLoader).toHaveBeenCalledTimes(1);
  });

  it('renders disabled product', async function () {
    const {router, routerContext} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.SESSION_REPLAY]},
        },
        params: {},
      },
    });

    const disabledProducts = {
      [ProductSolution.PERFORMANCE_MONITORING]: {
        reason: 'Product unavailable in this SDK version',
      },
    };

    render(
      <ProductSelection
        organization={organization}
        disabledProducts={disabledProducts}
        platform="javascript-react"
      />,
      {
        context: routerContext,
      }
    );

    // Performance Monitoring shall be unchecked and disabled by default
    expect(screen.getByRole('checkbox', {name: 'Performance Monitoring'})).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {name: 'Performance Monitoring'})
    ).not.toBeChecked();
    await userEvent.hover(screen.getByRole('checkbox', {name: 'Performance Monitoring'}));

    // A tooltip with explanation why the option is disabled shall be displayed on hover
    expect(
      await screen.findByText(
        disabledProducts[ProductSolution.PERFORMANCE_MONITORING].reason
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', {name: 'Performance Monitoring'}));

    // Try to uncheck performance monitoring
    await waitFor(() => expect(router.push).not.toHaveBeenCalled());
  });

  it('does not render Session Replay', async function () {
    platformProductAvailability['javascript-react'] = [
      ProductSolution.PERFORMANCE_MONITORING,
    ];

    const {router, routerContext} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.SESSION_REPLAY]},
        },
        params: {},
      },
    });

    render(<ProductSelection organization={organization} platform="javascript-react" />, {
      context: routerContext,
    });

    expect(
      screen.queryByRole('checkbox', {name: 'Session Replay'})
    ).not.toBeInTheDocument();

    // router.replace is called to remove session-replay from query
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: undefined,
        query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
      })
    );
  });

  it('render Profiling', async function () {
    const {router, routerContext} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
        },
        params: {},
      },
    });

    render(<ProductSelection organization={organization} platform="python-django" />, {
      context: routerContext,
    });

    expect(screen.getByRole('checkbox', {name: 'Profiling'})).toBeInTheDocument();

    // router.replace is called to add profiling from query
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: undefined,
        query: {
          product: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
        },
      })
    );
  });

  it('renders npm & yarn info text', function () {
    const {routerContext} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
        },
        params: {},
      },
    });

    render(<ProductSelection organization={organization} platform="javascript-react" />, {
      context: routerContext,
    });

    expect(screen.queryByText('npm')).toBeInTheDocument();
    expect(screen.queryByText('yarn')).toBeInTheDocument();
  });

  it('does not render npm & yarn info text', function () {
    const {routerContext} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
        },
        params: {},
      },
    });

    render(<ProductSelection organization={organization} platform="python-django" />, {
      context: routerContext,
    });

    expect(screen.queryByText('npm')).not.toBeInTheDocument();
    expect(screen.queryByText('yarn')).not.toBeInTheDocument();
  });
});
