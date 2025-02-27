import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {DataCategory} from 'sentry/types/core';

import CronsBetaTrialAlert from 'getsentry/components/productTrial/cronsBetaTrialAlert';
import type {ProductTrial} from 'getsentry/types';

describe('BetaCronsTrialAlert', function () {
  const api = new MockApiClient();
  const trial: ProductTrial = {
    category: DATA_CATEGORY_INFO.monitorSeat.plural,
    isStarted: true,
    reasonCode: 1004,
    startDate: moment().utc().subtract(12, 'days').format(),
    endDate: moment().utc().add(2, 'days').format(),
    lengthDays: 14,
  };

  it('Shows trial for billing role and can opt-in', async function () {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({organization});

    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
    });

    render(
      <CronsBetaTrialAlert
        api={api}
        organization={organization}
        subscription={subscription}
        trial={trial}
        product={DataCategory.MONITOR_SEATS}
      />
    );
    expect(screen.getByText('Free Beta ending soon')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You are using a free beta version of Crons. Please note, when your trial ends, you get one monitor for free and you agree to be billed for each additional monitor from your On Demand budget.'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'I Agree'}));
    expect(mockResponse).toHaveBeenCalledTimes(1);
  });

  it('Shows trial for non-billing role', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization});

    render(
      <CronsBetaTrialAlert
        api={api}
        organization={organization}
        subscription={subscription}
        trial={trial}
        product={DataCategory.MONITOR_SEATS}
      />
    );
    expect(screen.getByText('Free Beta ending soon')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You are using a free beta version of Crons. You will be able to continue using one monitor for free when the beta ends. If you need more than that, please have your billing admin log into Sentry to confirm.'
      )
    ).toBeInTheDocument();
  });
});
