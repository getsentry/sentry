import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {UsageTotalFixture} from 'getsentry-test/fixtures/usageTotal';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {UsageTotalsTable} from 'getsentry/views/subscriptionPage/usageTotalsTable';

describe('UsageTotalsTable', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'am3_team'});
  const totals = UsageTotalFixture({
    accepted: 50,
    dropped: 10,
    droppedOverQuota: 5,
    droppedSpikeProtection: 2,
    droppedOther: 3,
  });

  it('shows the spike protection bar segment and row for a category with spike protection', () => {
    render(
      <UsageTotalsTable
        category={DataCategory.ERRORS}
        totals={totals}
        subscription={subscription}
      />
    );

    expect(screen.getByTestId('ingestion-bar-accepted')).toBeInTheDocument();
    expect(screen.getByTestId('ingestion-bar-droppedOverQuota')).toBeInTheDocument();
    expect(
      screen.getByTestId('ingestion-bar-droppedSpikeProtection')
    ).toBeInTheDocument();
    expect(screen.getByTestId('ingestion-bar-droppedOther')).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Spike Protection 2 3%'})).toBeInTheDocument();
  });

  it('hides the spike protection bar segment and row for a category without spike protection', () => {
    render(
      <UsageTotalsTable
        category={DataCategory.PROFILE_DURATION}
        totals={totals}
        subscription={subscription}
      />
    );

    expect(screen.getByTestId('ingestion-bar-accepted')).toBeInTheDocument();
    expect(screen.getByTestId('ingestion-bar-droppedOverQuota')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ingestion-bar-droppedSpikeProtection')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ingestion-bar-droppedOther')).toBeInTheDocument();
    expect(screen.queryByRole('row', {name: /Spike Protection/})).not.toBeInTheDocument();
  });
});
