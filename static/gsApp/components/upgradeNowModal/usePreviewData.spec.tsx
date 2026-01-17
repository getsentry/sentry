import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PreviewDataFixture} from 'getsentry/__fixtures__/previewData';
import {PlanTier} from 'getsentry/types';

import type {Reservations} from './types';
import usePreviewData from './usePreviewData';

const mockReservations: Reservations = {
  reservedErrors: 50000,
  reservedReplays: 500,
  reservedAttachments: 1,
  reservedMonitorSeats: 1,
  reservedTransactions: 100000,
  reservedUptime: 1,
  reservedProfileDuration: 0,
  reservedProfileDurationUI: 0,
  reservedLogBytes: 5,
  reservedSpans: undefined,
  reservedSeerAutofix: 0,
  reservedSeerScanner: 0,
  reservedSeerUsers: 0,
};

const mockPreview = PreviewDataFixture({});

describe('usePreviewData', () => {
  const organization = OrganizationFixture({
    access: ['org:billing'],
  });

  it('should fetch a preview of a new AM2 plan, based on the current reservations', async () => {
    const teamPlan = PlanDetailsLookupFixture('am2_team');
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
    });
    const mockAM2BillingConfig = BillingConfigFixture(PlanTier.AM2);

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: mockAM2BillingConfig,
    });

    const previewRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: mockPreview,
    });

    const {result} = renderHookWithProviders(usePreviewData, {
      initialProps: {
        organization,
        subscription,
      },
    });

    await waitFor(() =>
      expect(result.current).toStrictEqual({
        loading: false,
        error: false,
        plan: teamPlan,
        reservations: mockReservations,
        previewData: mockPreview,
      })
    );
    expect(previewRequest).toHaveBeenCalledTimes(1);
  });
});
