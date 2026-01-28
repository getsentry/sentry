import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  platformProductAvailability,
  ProductSelection,
} from 'sentry/components/onboarding/productSelection';
import ConfigStore from 'sentry/stores/configStore';

describe('Onboarding Product Selection', () => {
  const organization = OrganizationFixture({
    features: ['session-replay', 'performance-view', 'profiling-view'],
  });

  beforeEach(() => {
    ConfigStore.init();
  });

  it('renders default state', async () => {
    const initialQuery = {
      product: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.SESSION_REPLAY],
    };

    const {router} = render(
      <ProductSelection organization={organization} platform="javascript-react" />,
      {
        initialRouterConfig: {
          location: {pathname: '/', query: initialQuery},
        },
      }
    );

    // Error monitoring shall be checked and disabled by default
    expect(screen.getByRole('presentation', {name: 'Error Monitoring'})).toBeChecked();

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(screen.getByRole('presentation', {name: 'Error Monitoring'}));
    expect(
      await screen.findByText(/Let's admit it, we all have errors/)
    ).toBeInTheDocument();

    // Try to uncheck error monitoring - should not change URL since it's always required
    await userEvent.click(screen.getByRole('presentation', {name: 'Error Monitoring'}));
    expect(router.location.query).toEqual(initialQuery);

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
    expect(router.location.query).toEqual({
      product: ProductSolution.SESSION_REPLAY,
    });

    // Session replay shall be checked and enabled by default
    expect(screen.getByRole('presentation', {name: 'Session Replay'})).toBeChecked();
    expect(screen.getByRole('presentation', {name: 'Session Replay'})).toBeEnabled();

    // Uncheck session replay (after tracing was already unchecked, so now both are removed)
    await userEvent.click(screen.getByRole('presentation', {name: 'Session Replay'}));
    expect(router.location.query).toEqual({});

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(screen.getByRole('presentation', {name: 'Session Replay'}));
    expect(
      await screen.findByText(/Video-like reproductions of user sessions/)
    ).toBeInTheDocument();
  });

  it('renders disabled product', async () => {
    const initialQuery = {product: ProductSolution.SESSION_REPLAY};

    const disabledProducts = {
      [ProductSolution.PERFORMANCE_MONITORING]: {
        reason: 'Product unavailable in this SDK version',
      },
    };

    const {router} = render(
      <ProductSelection
        organization={organization}
        disabledProducts={disabledProducts}
        platform="javascript-react"
      />,
      {
        initialRouterConfig: {
          location: {pathname: '/', query: initialQuery},
        },
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

    // Clicking disabled tracing should not change the URL
    await waitFor(() => expect(router.location.query).toEqual(initialQuery));
  });

  it('does not render Session Replay if not available for the platform', () => {
    platformProductAvailability['javascript-react'] = [
      ProductSolution.PERFORMANCE_MONITORING,
    ];

    const initialQuery = {product: ProductSolution.SESSION_REPLAY};

    const {router} = render(
      <ProductSelection organization={organization} platform="javascript-react" />,
      {
        initialRouterConfig: {
          location: {pathname: '/', query: initialQuery},
        },
      }
    );

    expect(
      screen.queryByRole('presentation', {name: 'Session Replay'})
    ).not.toBeInTheDocument();

    // URL should remain unchanged
    expect(router.location.query).toEqual(initialQuery);
  });

  it('does render Profiling if available for the platform', () => {
    const initialQuery = {product: ProductSolution.PERFORMANCE_MONITORING};

    const {router} = render(
      <ProductSelection organization={organization} platform="python-django" />,
      {
        initialRouterConfig: {
          location: {pathname: '/', query: initialQuery},
        },
      }
    );

    expect(screen.getByRole('presentation', {name: 'Profiling'})).toBeInTheDocument();

    // URL should remain unchanged
    expect(router.location.query).toEqual(initialQuery);
  });

  it('renders with non-errors features disabled for errors only self-hosted', () => {
    platformProductAvailability['javascript-react'] = [
      ProductSolution.PERFORMANCE_MONITORING,
      ProductSolution.SESSION_REPLAY,
    ];

    ConfigStore.set('isSelfHostedErrorsOnly', true);

    render(<ProductSelection organization={organization} platform="javascript-react" />, {
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {product: [ProductSolution.SESSION_REPLAY]},
        },
      },
    });

    expect(screen.getByRole('presentation', {name: 'Error Monitoring'})).toBeDisabled();
    expect(screen.getByRole('presentation', {name: 'Tracing'})).toBeDisabled();
    expect(screen.getByRole('presentation', {name: 'Session Replay'})).toBeDisabled();
  });

  it('does not select any products by default', () => {
    const {router} = render(
      <ProductSelection organization={organization} platform="python" />,
      {
        initialRouterConfig: {
          location: {pathname: '/', query: {}},
        },
      }
    );

    // URL should remain unchanged (no products auto-selected)
    expect(router.location.query).toEqual({});
  });

  it('triggers onChange callback', async () => {
    const handleChange = jest.fn();

    render(
      <ProductSelection
        organization={organization}
        platform="python-django"
        onChange={handleChange}
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
          },
        },
      }
    );

    await userEvent.click(screen.getByRole('presentation', {name: 'Profiling'}));
    expect(handleChange).toHaveBeenCalledWith({
      previousProducts: ['performance-monitoring'],
      products: ['performance-monitoring', 'profiling'],
    });
  });

  it('does not overwrite URL products if others are present', () => {
    const initialQuery = {
      product: ['invalid-product', ProductSolution.PERFORMANCE_MONITORING],
    };

    const {router} = render(
      <ProductSelection organization={organization} platform="javascript-react" />,
      {
        initialRouterConfig: {
          location: {pathname: '/', query: initialQuery},
        },
      }
    );

    expect(screen.getByRole('presentation', {name: 'Tracing'})).toBeChecked();

    // URL should remain unchanged
    expect(router.location.query).toEqual(initialQuery);
  });
});
