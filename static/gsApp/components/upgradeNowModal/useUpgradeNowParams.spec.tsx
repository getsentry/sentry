import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';

import {PlanTier} from 'getsentry/types';

import useUpgradeNowParams from './useUpgradeNowParams';

const teamPlan = PlanDetailsLookupFixture('am2_team');
const mockAM2BillingConfig = BillingConfigFixture(PlanTier.AM2);

describe('useUpgradeNowParams', () => {
  const organization = OrganizationFixture();

  it('should return the plan that matches the subscription settings', async () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
    });

    const billingConfigRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: mockAM2BillingConfig,
    });

    const {result} = renderHook(useUpgradeNowParams, {
      initialProps: {
        organization,
        subscription,
      },
      wrapper: ({children}) => (
        <QueryClientProvider client={makeTestQueryClient()}>
          {children}
        </QueryClientProvider>
      ),
    });

    expect(billingConfigRequest).toHaveBeenCalledTimes(1);
    expect(result.current).toStrictEqual({
      plan: undefined,
      reservations: undefined,
    });

    await waitFor(() => expect(billingConfigRequest).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.current).toStrictEqual({
        plan: teamPlan,
        reservations: {
          reservedErrors: 50000,
          reservedTransactions: 100000,
          reservedReplays: 500,
          reservedAttachments: 1,
          reservedMonitorSeats: 1,
          reservedUptime: 1,
        },
      })
    );
  });
});
