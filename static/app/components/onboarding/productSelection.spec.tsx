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
      ...initializeOrg(),
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
      screen.getByText(textWithMarkupMatcher(/In this quick guide you’ll use/))
    ).toBeInTheDocument();

    // Error monitoring shall be checked and disabled by default
    const errorMonitoring = screen.getByTestId(
      `product-${PRODUCT.ERROR_MONITORING}-${PRODUCT.PERFORMANCE_MONITORING}-${PRODUCT.SESSION_REPLAY}`
    );
    expect(within(errorMonitoring).getByText('Error Monitoring')).toBeInTheDocument();
    expect(within(errorMonitoring).getByRole('checkbox')).toBeChecked();
    expect(within(errorMonitoring).getByRole('checkbox')).toBeDisabled();

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

    // Uncheck performance monitoring
    await userEvent.click(performanceMonitoring);
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
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
      expect(router.push).toHaveBeenCalledWith({
        pathname: undefined,
        query: {product: ['performance-monitoring']},
      })
    );

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(within(sessionReplay).getByTestId('more-information'));
    expect(await screen.findByRole('link', {name: 'Read the Docs'})).toBeInTheDocument();
  });
});
