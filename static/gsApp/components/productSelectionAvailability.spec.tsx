import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {Organization} from 'sentry/types/organization';

import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {PreviewDataFixture} from 'getsentry/__fixtures__/previewData';
import {ProductSelectionAvailability} from 'getsentry/components/productSelectionAvailability';
import type {Reservations} from 'getsentry/components/upgradeNowModal/types';
import usePreviewData from 'getsentry/components/upgradeNowModal/usePreviewData';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';

jest.mock('getsentry/components/upgradeNowModal/usePreviewData');

function renderMockRequests({
  planTier,
  organization,
  canSelfServe,
}: {
  organization: Organization;
  planTier: PlanTier;
  canSelfServe?: boolean;
}) {
  const subscription = SubscriptionFixture({
    organization,
    planTier,
    canSelfServe,
  });

  act(() => SubscriptionStore.set(organization.slug, subscription));

  MockApiClient.addMockResponse({
    url: `/subscriptions/org-slug/`,
    body: {
      planTier,
      canSelfServe,
    },
  });

  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/billing-config/`,
    body: BillingConfigFixture(planTier),
  });
}

describe('ProductSelectionAvailability', function () {
  describe('with no billing access', function () {
    it('with performance and session replay', async function () {
      const {organization, router} = initializeOrg({
        organization: {
          features: ['performance-view', 'session-replay'],
        },
        router: {
          location: {
            query: {
              product: [
                ProductSolution.PERFORMANCE_MONITORING,
                ProductSolution.SESSION_REPLAY,
              ],
            },
          },
        },
      });

      renderMockRequests({planTier: PlanTier.AM2, organization});

      render(
        <ProductSelectionAvailability
          organization={organization}
          platform="javascript-react"
        />,
        {
          router,
        }
      );

      // Error Monitoring
      // disabled: false - it's not disabled because of the styles, but it behaves as if it were disabled
      // checked: true
      expect(await screen.findByRole('button', {name: 'Error Monitoring'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Error Monitoring'})).toBeChecked();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Error Monitoring'}));
      expect(
        await screen.findByText(/let's admit it, we all have errors/i)
      ).toBeInTheDocument();

      // Tracing
      // disabled: false
      // checked: true - by default, it's checked
      expect(screen.getByRole('button', {name: 'Tracing'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeChecked();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Tracing'}));
      expect(
        await screen.findByText(/automatic performance issue detection/i)
      ).toBeInTheDocument();

      // Session Replay
      // disabled: false
      // checked: true - by default, it's checked
      expect(screen.getByRole('button', {name: 'Session Replay'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Session Replay'})).toBeChecked();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Session Replay'}));
      expect(
        await screen.findByText(/video-like reproductions of user sessions/i)
      ).toBeInTheDocument();
    });

    it('without performance and session replay', async function () {
      const {organization, router} = initializeOrg();

      renderMockRequests({planTier: PlanTier.MM2, organization, canSelfServe: true});

      render(
        <ProductSelectionAvailability
          organization={organization}
          platform="javascript-react"
        />,
        {
          router,
        }
      );

      // Error Monitoring
      // disabled: false - it's not disabled because of the styles, but it behaves as if it were disabled
      // checked: true
      expect(await screen.findByRole('button', {name: 'Error Monitoring'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Error Monitoring'})).toBeChecked();

      // Tracing
      // disabled: true
      // checked: false
      expect(screen.getByRole('button', {name: 'Tracing'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'Tracing'})).not.toBeChecked();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Tracing'}));
      expect(
        await screen.findByText(/to use performance, request an owner/i)
      ).toBeInTheDocument();

      // Session Replay
      // disabled: true
      // checked: false
      expect(screen.getByRole('button', {name: 'Session Replay'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'Session Replay'})).not.toBeChecked();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Session Replay'}));
      expect(
        await screen.findByText(/to use session replay, request an owner/i)
      ).toBeInTheDocument();
    });

    it('without session replay', async function () {
      const {organization, router} = initializeOrg({
        organization: {
          features: ['performance-view'],
        },
        router: {
          location: {
            query: {
              product: [ProductSolution.PERFORMANCE_MONITORING],
            },
          },
        },
      });

      renderMockRequests({planTier: PlanTier.AM1, organization});

      render(
        <ProductSelectionAvailability
          organization={organization}
          platform="javascript-react"
        />,
        {
          router,
        }
      );

      // Error Monitoring
      // disabled: false - it's not disabled because of the styles, but it behaves as if it were disabled
      // checked: true
      expect(await screen.findByRole('button', {name: 'Error Monitoring'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Error Monitoring'})).toBeChecked();

      // Tracing
      // disabled: false
      // checked: true - by default, it's checked
      expect(screen.getByRole('button', {name: 'Tracing'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeChecked();

      // Session Replay
      // disabled: true
      // checked: false
      expect(screen.getByRole('button', {name: 'Session Replay'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'Session Replay'})).not.toBeChecked();
    });
  });

  describe('with billing access', function () {
    it('with performance and session replay', async function () {
      const {organization, router} = initializeOrg({
        organization: {
          features: ['performance-view', 'session-replay'],
          access: ['org:billing'] as any, // TODO(ts): Fix this type for organizations on a plan
        },
        router: {
          location: {
            query: {
              product: [
                ProductSolution.PERFORMANCE_MONITORING,
                ProductSolution.SESSION_REPLAY,
              ],
            },
          },
        },
      });

      renderMockRequests({planTier: PlanTier.AM2, organization});

      render(
        <ProductSelectionAvailability
          organization={organization}
          platform="javascript-react"
        />,
        {
          router,
        }
      );

      // Error Monitoring
      // disabled: false - it's not disabled because of the styles, but it behaves as if it were disabled
      // checked: true
      expect(await screen.findByRole('button', {name: 'Error Monitoring'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Error Monitoring'})).toBeChecked();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Error Monitoring'}));
      expect(
        await screen.findByText(/let's admit it, we all have errors/i)
      ).toBeInTheDocument();

      // Tracing
      // disabled: false
      // checked: true - by default, it's checked
      expect(screen.getByRole('button', {name: 'Tracing'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeChecked();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Tracing'}));
      expect(
        await screen.findByText(/automatic performance issue detection/i)
      ).toBeInTheDocument();

      // Session Replay
      // disabled: false
      // checked: true - by default, it's checked
      expect(screen.getByRole('button', {name: 'Session Replay'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Session Replay'})).toBeChecked();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Session Replay'}));
      expect(
        await screen.findByText(/video-like reproductions of user sessions/i)
      ).toBeInTheDocument();
    });

    it('without performance, session replay and profiling', async function () {
      const {organization, router} = initializeOrg({
        organization: {
          access: ['org:billing'] as any, // TODO(ts): Fix this type for organizations on a plan
        },
      });

      renderMockRequests({planTier: PlanTier.MM2, organization});

      render(
        <ProductSelectionAvailability
          organization={organization}
          platform="javascript-react"
        />,
        {
          router,
        }
      );

      // Error Monitoring
      // disabled: false - it's not disabled because of the styles, but it behaves as if it were disabled
      // checked: true
      expect(await screen.findByRole('button', {name: 'Error Monitoring'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Error Monitoring'})).toBeChecked();

      // Tracing
      // disabled: true
      // checked: false
      expect(screen.getByRole('button', {name: 'Tracing'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'Tracing'})).not.toBeChecked();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Tracing'}));
      expect(
        await screen.findByText(/to use performance, update your organization's plan/i)
      ).toBeInTheDocument();

      // Session Replay
      // disabled: true - We don't display an upsell modal to users on MM* plans
      // checked: false
      expect(screen.getByRole('button', {name: 'Session Replay'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'Session Replay'})).not.toBeChecked();
      expect(screen.getByRole('checkbox', {name: 'Session Replay'})).toBeDisabled();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Session Replay'}));
      expect(
        await screen.findByText(/to use session replay, update your organization's plan/i)
      ).toBeInTheDocument();
    });

    it('without session replay', async function () {
      const {organization, router} = initializeOrg({
        organization: {
          access: ['org:billing'] as any, // TODO(ts): Fix this type for organizations on a plan
          features: ['performance-view'],
        },
        router: {
          location: {
            query: {
              product: [ProductSolution.PERFORMANCE_MONITORING],
            },
          },
        },
      });

      const MockUsePreviewData = usePreviewData as jest.MockedFunction<
        typeof usePreviewData
      >;
      const mockReservations: Reservations = {
        reservedErrors: 50000,
        reservedTransactions: 0,
        reservedReplays: 500,
        reservedAttachments: 0,
        reservedMonitorSeats: 0,
        reservedUptime: 0,
      };
      const mockPlan = PlanFixture({});
      const mockPreview = PreviewDataFixture({});

      MockUsePreviewData.mockReturnValue({
        loading: false,
        error: false,
        plan: mockPlan,
        previewData: mockPreview,
        reservations: mockReservations,
      });

      // can self-serve
      renderMockRequests({planTier: PlanTier.AM1, organization, canSelfServe: true});

      const {rerender} = render(
        <ProductSelectionAvailability
          organization={organization}
          platform="javascript-react"
        />,
        {
          router,
        }
      );

      // Error Monitoring
      // disabled: false - it's not disabled because of the styles, but it behaves as if it were disabled
      // checked: true
      expect(await screen.findByRole('button', {name: 'Error Monitoring'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Error Monitoring'})).toBeChecked();

      // Tracing
      // disabled: false
      // checked: true - by default, it's checked
      expect(screen.getByRole('button', {name: 'Tracing'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeChecked();

      // Session Replay
      // disabled: false - By clicking on the button, an upsell modal is shown
      // checked: false
      expect(screen.getByRole('button', {name: 'Session Replay'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Session Replay'})).not.toBeChecked();
      expect(screen.getByRole('checkbox', {name: 'Session Replay'})).toBeDisabled();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Session Replay'}));
      expect(
        await screen.findByText(/to use session replay, update your organization's plan/i)
      ).toBeInTheDocument();

      renderGlobalModal();
      // Modal
      await userEvent.click(screen.getByRole('button', {name: 'Session Replay'}));
      expect(
        await screen.findByRole('heading', {name: /enable session replays now/i})
      ).toBeInTheDocument();

      // can't self-serve
      renderMockRequests({planTier: PlanTier.AM1, organization, canSelfServe: false});
      rerender(
        <ProductSelectionAvailability
          organization={organization}
          platform="javascript-react"
        />
      );
      // Session Replay
      // disabled: true - We don't display an upsell modal to users who has access to billing but cannot self-serve
      // checked: false
      expect(await screen.findByRole('button', {name: 'Session Replay'})).toBeDisabled();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Session Replay'}));
      expect(await screen.findByText(/Manage Subscription/i)).toBeInTheDocument();
    });

    it('with profiling and without session replay', async function () {
      const {organization, router} = initializeOrg({
        organization: {
          features: ['performance-view', 'profiling-view'],
        },
        router: {
          location: {
            query: {
              product: [
                ProductSolution.PERFORMANCE_MONITORING,
                ProductSolution.PROFILING,
              ],
            },
          },
        },
      });

      renderMockRequests({planTier: PlanTier.AM2, organization});

      render(
        <ProductSelectionAvailability
          organization={organization}
          platform="python-django"
        />,
        {
          router,
        }
      );

      // Error Monitoring
      // disabled: false - it's not disabled because of the styles, but it behaves as if it were disabled
      // checked: true
      expect(await screen.findByRole('button', {name: 'Error Monitoring'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Error Monitoring'})).toBeChecked();

      // Tracing
      // disabled: false
      // checked: true - by default, it's checked
      expect(screen.getByRole('button', {name: 'Tracing'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeChecked();

      // Session Replay (not rendered)
      expect(
        screen.queryByRole('button', {name: 'Session Replay'})
      ).not.toBeInTheDocument();

      // Profiling
      // disabled: false
      // checked: true - by default, it's checked
      expect(screen.getByRole('button', {name: 'Profiling'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Profiling'})).toBeChecked();
    });

    it('without profiling and without session replay', async function () {
      const {organization, router} = initializeOrg({
        organization: {
          features: ['performance-view'],
        },
        router: {
          location: {
            query: {
              product: [ProductSolution.PERFORMANCE_MONITORING],
            },
          },
        },
      });

      renderMockRequests({planTier: PlanTier.AM2, organization});

      render(
        <ProductSelectionAvailability
          organization={organization}
          platform="python-django"
        />,
        {
          router,
        }
      );

      // Error Monitoring
      // disabled: false - it's not disabled because of the styles, but it behaves as if it were disabled
      // checked: true
      expect(await screen.findByRole('button', {name: 'Error Monitoring'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Error Monitoring'})).toBeChecked();

      // Tracing
      // disabled: false
      // checked: true - by default, it's checked
      expect(screen.getByRole('button', {name: 'Tracing'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeChecked();

      // Session Replay (not rendered)
      expect(
        screen.queryByRole('button', {name: 'Session Replay'})
      ).not.toBeInTheDocument();

      // Profiling
      // disabled: false
      // checked: false
      expect(screen.getByRole('button', {name: 'Profiling'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'Profiling'})).not.toBeChecked();
      expect(screen.getByRole('checkbox', {name: 'Profiling'})).toBeDisabled();
      // Tooltip
      await userEvent.hover(screen.getByRole('button', {name: 'Profiling'}));
      expect(
        await screen.findByText(/to use profiling, update your organization's plan/i)
      ).toBeInTheDocument();
    });

    // TODO: This test does not play well with deselected products by default
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('enabling Profiling, shall check and "disabled" Tracing', async function () {
      const {router, organization} = initializeOrg({
        organization: {
          features: ['performance-view', 'profiling-view'],
        },
        router: {
          location: {
            query: {
              product: [ProductSolution.PROFILING],
            },
          },
        },
      });

      renderMockRequests({planTier: PlanTier.AM2, organization});

      render(
        <ProductSelectionAvailability
          organization={organization}
          platform="python-django"
        />,
        {
          router,
        }
      );

      // Performance is added to the query string, so it will be checked
      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith(
          expect.objectContaining({
            query: expect.objectContaining({
              product: [
                ProductSolution.PERFORMANCE_MONITORING,
                ProductSolution.PROFILING,
              ],
            }),
          })
        );
      });

      // Tracing
      // disabled: false - it's not disabled because of the styles, but it behaves as if it were disabled
      expect(screen.getByRole('button', {name: 'Tracing'})).toBeEnabled();
    });

    it('with Profiling and Tracing', async function () {
      const {router, organization} = initializeOrg({
        organization: {
          features: ['performance-view', 'profiling-view'],
        },
        router: {
          location: {
            query: {
              product: [
                ProductSolution.PROFILING,
                ProductSolution.PERFORMANCE_MONITORING,
              ],
            },
          },
        },
      });

      renderMockRequests({planTier: PlanTier.AM2, organization});

      render(
        <ProductSelectionAvailability
          organization={organization}
          platform="python-django"
        />,
        {
          router,
        }
      );
      // Tracing
      expect(screen.getByRole('button', {name: 'Tracing'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Tracing'})).toBeChecked();

      // Profiling
      expect(screen.getByRole('button', {name: 'Profiling'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'Profiling'})).toBeChecked();

      await userEvent.click(screen.getByRole('button', {name: 'Profiling'}));
      // profiling is removed from the query string
      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith(
          expect.objectContaining({
            query: expect.objectContaining({
              product: [ProductSolution.PERFORMANCE_MONITORING],
            }),
          })
        );
      });
    });
  });
});
