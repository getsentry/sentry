import {OrganizationFixture} from 'sentry-fixture/organization';

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

import type {Organization} from 'sentry/types/organization';

import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {PreviewDataFixture} from 'getsentry/__fixtures__/previewData';
import {ProductUnavailableCTA} from 'getsentry/components/productUnavailableCTA';
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
    url: `/subscriptions/${organization.slug}/`,
    body: {
      planTier,
    },
  });

  const isAncientPlan = [PlanTier.MM1, PlanTier.MM2].includes(planTier);

  if (isAncientPlan) {
    const requestUpdatePlan = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/plan-upgrade-request/`,
      method: 'POST',
    });

    return {requestUpdatePlan};
  }

  const requestUpdatePlanDueToReplay = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/replay-onboard-request/`,
    method: 'POST',
  });

  return {requestUpdatePlanDueToReplay};
}

describe('ProductUnavailableCTA', () => {
  describe('with no billing access', () => {
    it('renders no alert', () => {
      const organization = OrganizationFixture({
        features: ['performance-view', 'session-replay'],
      });

      renderMockRequests({
        planTier: PlanTier.AM2,
        organization,
      });

      const {container} = render(<ProductUnavailableCTA organization={organization} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('without performance and session replay', async () => {
      const {organization} = initializeOrg();

      const mockRequests = renderMockRequests({
        planTier: PlanTier.MM1,
        organization,
      });

      render(<ProductUnavailableCTA organization={organization} />);

      expect(
        await screen.findByText(/request an owner in your organization to update/i)
      ).toBeInTheDocument();

      expect(screen.getByText(/use performance and session replay/i)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /request update/i}));

      await waitFor(() => {
        expect(mockRequests?.requestUpdatePlan).toHaveBeenCalledWith(
          `/organizations/org-slug/plan-upgrade-request/`,
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('without session replay', async () => {
      const {organization} = initializeOrg({
        organization: {
          features: ['performance-view'],
        },
      });

      const mockRequests = renderMockRequests({
        planTier: PlanTier.AM1,
        organization,
      });

      render(<ProductUnavailableCTA organization={organization} />);

      expect(
        await screen.findByText(/request an owner in your organization to update/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/use session replay/i)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /request update/i}));

      await waitFor(() => {
        expect(mockRequests.requestUpdatePlanDueToReplay).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/replay-onboard-request/`,
          expect.objectContaining({
            method: 'POST',
            data: {
              name: 'am1-non-beta',
            },
          })
        );
      });
    });
  });

  describe('with billing access', () => {
    it('renders no alert', () => {
      const organization = OrganizationFixture({
        access: ['org:billing'],
        features: ['performance-view', 'session-replay'],
      });

      renderMockRequests({
        planTier: PlanTier.AM2,
        organization,
      });

      const {container} = render(<ProductUnavailableCTA organization={organization} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('without performance and session replay', async () => {
      const {organization} = initializeOrg({
        organization: {
          access: ['org:billing'] as any, // TODO(ts): Fix this type for organizations on a plan
        },
      });

      renderMockRequests({
        planTier: PlanTier.MM1,
        organization,
      });

      render(<ProductUnavailableCTA organization={organization} />);

      expect(await screen.findByText(/update your organization/i)).toBeInTheDocument();
      expect(screen.getByText(/use performance and session replay/i)).toBeInTheDocument();

      expect(screen.getByRole('button', {name: /manage subscription/i})).toHaveAttribute(
        'href',
        '/settings/org-slug/billing/overview/?referrer=replay_onboard_mmx-cta'
      );
    });

    it('without session replay', async () => {
      const {organization} = initializeOrg({
        organization: {
          access: ['org:billing'] as any, // TODO(ts): Fix this type for organizations on a plan
          features: ['performance-view'],
        },
      });

      // can self-serve
      renderMockRequests({
        planTier: PlanTier.AM1,
        organization,
        canSelfServe: true,
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
        reservedProfileDuration: 0,
        reservedProfileDurationUI: 0,
        reservedLogBytes: 0,
        reservedSpans: undefined,
        reservedSeerAutofix: undefined,
        reservedSeerScanner: undefined,
        reservedSeerUsers: undefined,
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

      const {rerender} = render(<ProductUnavailableCTA organization={organization} />);

      expect(await screen.findByText(/update your organization/i)).toBeInTheDocument();
      expect(screen.getByText(/use session replay/i)).toBeInTheDocument();

      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: /update plan/i}));

      expect(
        await screen.findByRole('heading', {name: /enable session replays now/i})
      ).toBeInTheDocument();

      // can not self-serve
      renderMockRequests({
        planTier: PlanTier.AM1,
        organization,
        canSelfServe: false,
      });
      rerender(<ProductUnavailableCTA organization={organization} />);
      expect(
        await screen.findByRole('button', {name: /manage subscription/i})
      ).toBeInTheDocument();
    });
  });
});
