import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  platformProductAvailability,
  ProductSelection,
} from 'sentry/components/onboarding/productSelection';
import ConfigStore from 'sentry/stores/configStore';

describe('Onboarding Product Selection', function () {
  const organization = OrganizationFixture({
    features: ['session-replay', 'performance-view', 'profiling-view'],
  });

  beforeEach(function () {
    ConfigStore.init();
  });

  it('renders default state', async function () {
    const {router} = initializeOrg({
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
      router,
      deprecatedRouterMocks: true,
    });

    // Error monitoring shall be checked and disabled by default
    expect(screen.getByRole('presentation', {name: 'Error Monitoring'})).toBeChecked();

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(screen.getByRole('presentation', {name: 'Error Monitoring'}));
    expect(
      await screen.findByText(/Let's admit it, we all have errors/)
    ).toBeInTheDocument();

    // Try to uncheck error monitoring
    await userEvent.click(screen.getByRole('presentation', {name: 'Error Monitoring'}));
    expect(router.push).not.toHaveBeenCalled();

    // Tracing shall be checked and enabled by default
    expect(screen.getByRole('presentation', {name: 'Tracing'})).toBeChecked();
    expect(screen.getByRole('presentation', {name: 'Tracing'})).toBeEnabled();

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(screen.getByRole('presentation', {name: 'Tracing'}));
    expect(
      await screen.findByText(/Automatic performance issue detection/)
    ).toBeInTheDocument();

    // Uncheck tracing
    await userEvent.click(screen.getByRole('presentation', {name: 'Tracing'}));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: undefined,
      query: {product: [ProductSolution.SESSION_REPLAY]},
    });

    // Session replay shall be checked and enabled by default
    expect(screen.getByRole('presentation', {name: 'Session Replay'})).toBeChecked();
    expect(screen.getByRole('presentation', {name: 'Session Replay'})).toBeEnabled();

    // Uncheck sesseion replay
    await userEvent.click(screen.getByRole('presentation', {name: 'Session Replay'}));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: undefined,
      query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
    });

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(screen.getByRole('presentation', {name: 'Session Replay'}));
    expect(
      await screen.findByText(/Video-like reproductions of user sessions/)
    ).toBeInTheDocument();
  });

  it('renders disabled product', async function () {
    const {router} = initializeOrg({
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
        router,
        deprecatedRouterMocks: true,
      }
    );

    // Tracing shall be unchecked and disabled by default
    expect(screen.getByRole('presentation', {name: 'Tracing'})).toBeDisabled();
    expect(screen.getByRole('presentation', {name: 'Tracing'})).not.toBeChecked();
    await userEvent.hover(screen.getByRole('presentation', {name: 'Tracing'}));

    // A tooltip with explanation why the option is disabled shall be displayed on hover
    expect(
      await screen.findByText(
        disabledProducts[ProductSolution.PERFORMANCE_MONITORING].reason
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('presentation', {name: 'Tracing'}));

    // Try to uncheck tracing
    await waitFor(() => expect(router.push).not.toHaveBeenCalled());
  });

  it('does not render Session Replay if not available for the platform', function () {
    platformProductAvailability['javascript-react'] = [
      ProductSolution.PERFORMANCE_MONITORING,
    ];

    const {router} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.SESSION_REPLAY]},
        },
        params: {},
      },
    });

    render(<ProductSelection organization={organization} platform="javascript-react" />, {
      router,
      deprecatedRouterMocks: true,
    });

    expect(
      screen.queryByRole('presentation', {name: 'Session Replay'})
    ).not.toBeInTheDocument();

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does render Profiling if available for the platform', function () {
    const {router} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
        },
        params: {},
      },
    });

    render(<ProductSelection organization={organization} platform="python-django" />, {
      router,
      deprecatedRouterMocks: true,
    });

    expect(screen.getByRole('presentation', {name: 'Profiling'})).toBeInTheDocument();

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('renders with non-errors features disabled for errors only self-hosted', function () {
    platformProductAvailability['javascript-react'] = [
      ProductSolution.PERFORMANCE_MONITORING,
      ProductSolution.SESSION_REPLAY,
    ];

    const {router} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.SESSION_REPLAY]},
        },
        params: {},
      },
    });

    ConfigStore.set('isSelfHostedErrorsOnly', true);

    render(<ProductSelection organization={organization} platform="javascript-react" />, {
      router,
      deprecatedRouterMocks: true,
    });

    expect(screen.getByRole('presentation', {name: 'Error Monitoring'})).toBeDisabled();
    expect(screen.getByRole('presentation', {name: 'Tracing'})).toBeDisabled();
    expect(screen.getByRole('presentation', {name: 'Session Replay'})).toBeDisabled();
  });

  it('does not select any products by default', function () {
    const {router} = initializeOrg({
      router: {
        location: {
          query: {},
        },
        params: {},
      },
    });

    render(<ProductSelection organization={organization} platform="python" />, {
      router,
      deprecatedRouterMocks: true,
    });

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('triggers onChange callback', async function () {
    const {router} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
        },
        params: {},
      },
    });

    const handleChange = jest.fn();

    render(
      <ProductSelection
        organization={organization}
        platform="python-django"
        onChange={handleChange}
      />,
      {
        router,
        deprecatedRouterMocks: true,
      }
    );

    await userEvent.click(screen.getByRole('presentation', {name: 'Profiling'}));
    expect(handleChange).toHaveBeenCalledWith({
      previousProducts: ['performance-monitoring'],
      products: ['performance-monitoring', 'profiling'],
    });
  });

  it('does not overwrite URL products if others are present', function () {
    const {router} = initializeOrg({
      router: {
        location: {
          query: {product: ['invalid-product', ProductSolution.PERFORMANCE_MONITORING]},
        },
        params: {},
      },
    });

    render(<ProductSelection organization={organization} platform="javascript-react" />, {
      router,
      deprecatedRouterMocks: true,
    });

    expect(screen.getByRole('presentation', {name: 'Tracing'})).toBeChecked();

    expect(router.replace).not.toHaveBeenCalled();
  });
});
