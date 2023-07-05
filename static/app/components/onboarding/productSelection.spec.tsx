import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
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
        query: {product: ['session-replay']},
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
        query: {product: ['performance-monitoring']},
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

  it('renders disabled product', async function () {
    const {router, routerContext} = initializeOrg({
      router: {
        location: {
          query: {product: ['session-replay']},
        },
        params: {},
      },
    });

    const disabledProducts = [
      {
        product: PRODUCT.PERFORMANCE_MONITORING,
        reason: 'Product unavailable in this SDK version',
      },
    ];

    render(<ProductSelection disabledProducts={disabledProducts} />, {
      context: routerContext,
    });

    // Performance Monitoring shall be unchecked and disabled by default
    expect(screen.getByRole('checkbox', {name: 'Performance Monitoring'})).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {name: 'Performance Monitoring'})
    ).not.toBeChecked();
    await userEvent.hover(screen.getByRole('checkbox', {name: 'Performance Monitoring'}));

    // A tooltip with explanation why the option is disabled shall be displayed on hover
    expect(await screen.findByText(disabledProducts[0]!.reason)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', {name: 'Performance Monitoring'}));

    // Try to uncheck performance monitoring
    await waitFor(() => expect(router.push).not.toHaveBeenCalled());
  });
});
