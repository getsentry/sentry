import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  platformProductAvailability,
  ProductSelection,
  ProductSolution,
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
    const {router, project} = initializeOrg({
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

    render(
      <ProductSelection
        organization={organization}
        platform="javascript-react"
        projectId={project.id}
      />,
      {
        router,
      }
    );

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

    // Tracing shall be checked and enabled by default
    expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeEnabled();

    // Tooltip with explanation shall be displayed on hover
    await userEvent.hover(screen.getByRole('checkbox', {name: 'Tracing'}));
    expect(
      await screen.findByText(/Automatic performance issue detection/)
    ).toBeInTheDocument();

    // Uncheck tracing
    await userEvent.click(screen.getByRole('checkbox', {name: 'Tracing'}));
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
    const {router, project} = initializeOrg({
      router: {
        location: {
          query: {
            showLoader: 'true',
            product: [
              ProductSolution.PERFORMANCE_MONITORING,
              ProductSolution.SESSION_REPLAY,
            ],
          },
        },
        params: {},
      },
    });

    render(
      <ProductSelection
        organization={organization}
        platform="javascript"
        projectId={project.id}
      />,
      {
        router,
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

    await userEvent.click(screen.getByText('View npm/yarn instructions'));

    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          product: ['performance-monitoring', 'session-replay'],
          showLoader: false,
        },
      })
    );
  });

  it('renders disabled product', async function () {
    const {router, project} = initializeOrg({
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
        projectId={project.id}
      />,
      {
        router,
      }
    );

    // Tracing shall be unchecked and disabled by default
    expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeDisabled();
    expect(screen.getByRole('checkbox', {name: 'Tracing'})).not.toBeChecked();
    await userEvent.hover(screen.getByRole('checkbox', {name: 'Tracing'}));

    // A tooltip with explanation why the option is disabled shall be displayed on hover
    expect(
      await screen.findByText(
        disabledProducts[ProductSolution.PERFORMANCE_MONITORING].reason
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', {name: 'Tracing'}));

    // Try to uncheck tracing
    await waitFor(() => expect(router.push).not.toHaveBeenCalled());
  });

  it('does not render Session Replay', async function () {
    platformProductAvailability['javascript-react'] = [
      ProductSolution.PERFORMANCE_MONITORING,
    ];

    const {router, project} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.SESSION_REPLAY]},
        },
        params: {},
      },
    });

    render(
      <ProductSelection
        organization={organization}
        platform="javascript-react"
        projectId={project.id}
      />,
      {
        router,
      }
    );

    expect(
      screen.queryByRole('checkbox', {name: 'Session Replay'})
    ).not.toBeInTheDocument();

    // router.replace is called to remove session-replay from query
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            product: [ProductSolution.PERFORMANCE_MONITORING],
          }),
        })
      )
    );
  });

  it('render Profiling', async function () {
    const {router, project} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
        },
        params: {},
      },
    });

    render(
      <ProductSelection
        organization={organization}
        platform="python-django"
        projectId={project.id}
      />,
      {
        router,
      }
    );

    expect(screen.getByRole('checkbox', {name: 'Profiling'})).toBeInTheDocument();

    // router.replace is called to add profiling from query
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            product: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
          }),
        })
      )
    );
  });

  it('renders with non-errors features disabled for errors only self-hosted', function () {
    platformProductAvailability['javascript-react'] = [
      ProductSolution.PERFORMANCE_MONITORING,
      ProductSolution.SESSION_REPLAY,
    ];

    const {router, project} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.SESSION_REPLAY]},
        },
        params: {},
      },
    });

    ConfigStore.set('isSelfHostedErrorsOnly', true);

    render(
      <ProductSelection
        organization={organization}
        platform="javascript-react"
        projectId={project.id}
      />,
      {
        router,
      }
    );

    expect(screen.getByRole('checkbox', {name: 'Error Monitoring'})).toBeEnabled();

    expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeDisabled();

    expect(screen.getByRole('checkbox', {name: 'Session Replay'})).toBeDisabled();
  });

  it('renders npm & yarn info text', function () {
    const {router, project} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
        },
        params: {},
      },
    });

    render(
      <ProductSelection
        organization={organization}
        platform="javascript-react"
        projectId={project.id}
      />,
      {
        router,
      }
    );

    expect(screen.queryByText('npm')).toBeInTheDocument();
    expect(screen.queryByText('yarn')).toBeInTheDocument();
  });

  it('does not render npm & yarn info text', function () {
    const {router, project} = initializeOrg({
      router: {
        location: {
          query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
        },
        params: {},
      },
    });

    render(
      <ProductSelection
        organization={organization}
        platform="python-django"
        projectId={project.id}
      />,
      {
        router,
      }
    );

    expect(screen.queryByText('npm')).not.toBeInTheDocument();
    expect(screen.queryByText('yarn')).not.toBeInTheDocument();
  });
});
