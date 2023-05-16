import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {PRODUCT, ProductSelection} from 'sentry/components/onboarding/productSelection';

describe('Onboarding Product Selection', function () {
  it('renders default state', async function () {
    const {router, routerContext} = initializeOrg({
      router: {
        location: {
          query: {product: ['performance-monitoring', 'session-replay']},
        },
        params: {},
      },
    });

    render(<ProductSelection />, {
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
    const errorMonitoring = screen.getByTestId(
      `product-${PRODUCT.ERROR_MONITORING}-${PRODUCT.PERFORMANCE_MONITORING}-${PRODUCT.SESSION_REPLAY}`
    );
    expect(within(errorMonitoring).getByText('Error Monitoring')).toBeInTheDocument();
    expect(within(errorMonitoring).getByRole('checkbox')).toBeChecked();
    expect(within(errorMonitoring).getByRole('checkbox')).toBeDisabled();

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(errorMonitoring);
    expect(
      await screen.findByText(/Let's admit it, we all have errors/)
    ).toBeInTheDocument();

    // Try to uncheck error monitoring
    await userEvent.click(errorMonitoring);
    await waitFor(() => expect(router.push).not.toHaveBeenCalled());

    // Performance monitoring shall be checked and enabled by default
    const performanceMonitoring = screen.getByTestId(
      `product-${PRODUCT.PERFORMANCE_MONITORING}`
    );
    expect(
      within(performanceMonitoring).getByText('Performance Monitoring')
    ).toBeInTheDocument();
    expect(within(performanceMonitoring).getByRole('checkbox')).toBeChecked();
    expect(within(performanceMonitoring).getByRole('checkbox')).toBeEnabled();

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(performanceMonitoring);
    expect(
      await screen.findByText(/Automatic performance issue detection/)
    ).toBeInTheDocument();

    // Uncheck performance monitoring
    await userEvent.click(performanceMonitoring);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: undefined,
        query: {product: ['session-replay']},
      })
    );

    // Session replay shall be checked and enabled by default
    const sessionReplay = screen.getByTestId(`product-${PRODUCT.SESSION_REPLAY}`);
    expect(within(sessionReplay).getByText('Session Replay')).toBeInTheDocument();
    expect(within(sessionReplay).getByRole('checkbox')).toBeChecked();
    expect(within(sessionReplay).getByRole('checkbox')).toBeEnabled();

    // Uncheck sesseion replay
    await userEvent.click(sessionReplay);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: undefined,
        query: {product: ['performance-monitoring']},
      })
    );

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(sessionReplay);
    expect(
      await screen.findByText(/Video-like reproductions of user sessions/)
    ).toBeInTheDocument();
  });

  it('renders for Loader Script', async function () {
    const {routerContext} = initializeOrg({
      router: {
        location: {
          query: {product: ['performance-monitoring', 'session-replay']},
        },
        params: {},
      },
    });

    const skipLazyLoader = jest.fn();

    render(<ProductSelection lazyLoader skipLazyLoader={skipLazyLoader} />, {
      context: routerContext,
    });

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
});
