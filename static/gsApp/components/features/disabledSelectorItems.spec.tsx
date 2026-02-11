import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PlanFixture} from 'getsentry/__fixtures__/plan';
import DisabledSelectorItems from 'getsentry/components/features/disabledSelectorItems';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

describe('DisabledSelectorItems', () => {
  const handleSelectRelative = jest.fn();

  it('renders extended relative periods without sub', () => {
    const organization = OrganizationFixture();
    SubscriptionStore.set(organization.slug, {});

    render(
      <DisabledSelectorItems
        shouldShowRelative
        shouldShowAbsolute
        handleSelectRelative={handleSelectRelative}
      >
        {items => (
          <div>
            {items.map(item => (
              <div key={item.value}>{item.label}</div>
            ))}
          </div>
        )}
      </DisabledSelectorItems>
    );

    expect(screen.getByText('Last hour')).toBeInTheDocument();
    expect(screen.getByText('Last 14 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
    expect(screen.queryByText(/Start Trial/)).not.toBeInTheDocument();
  });

  it('renders extended relative periods for paid plan', () => {
    const organization = OrganizationFixture({slug: 'paid'});
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        plan: 'mm2_b_100k',
        planDetails: PlanFixture({
          retentionDays: 90,
        }),
      })
    );

    render(
      <DisabledSelectorItems
        shouldShowRelative
        shouldShowAbsolute
        handleSelectRelative={handleSelectRelative}
      >
        {items => (
          <div>
            {items.map(item => (
              <div key={item.value}>{item.label}</div>
            ))}
          </div>
        )}
      </DisabledSelectorItems>,
      {organization}
    );

    expect(screen.getByText('Last hour')).toBeInTheDocument();
    expect(screen.getByText('Last 14 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
    expect(screen.queryByText(/Start Trial/)).not.toBeInTheDocument();
  });

  it('renders upsell and not extended relative periods for free plan', () => {
    const organization = OrganizationFixture({slug: 'free'});
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        plan: 'mm2_f',
        planDetails: PlanFixture({
          retentionDays: 30,
        }),
      })
    );

    render(
      <DisabledSelectorItems
        shouldShowRelative
        shouldShowAbsolute
        handleSelectRelative={handleSelectRelative}
      >
        {items => (
          <div>
            {items.map(item => (
              <div key={item.value}>{item.label}</div>
            ))}
          </div>
        )}
      </DisabledSelectorItems>,
      {organization}
    );

    expect(screen.getByText('Last hour')).toBeInTheDocument();
    expect(screen.getByText('Last 14 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
    expect(screen.getByText(/Start Trial/)).toBeInTheDocument();
  });

  it('does not render upsell when 90 day is not a relative option for free plan', () => {
    const organization = OrganizationFixture({slug: 'free'});
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        plan: 'mm2_f',
        planDetails: PlanFixture({
          retentionDays: 30,
        }),
      })
    );

    render(
      <DisabledSelectorItems
        shouldShowRelative
        shouldShowAbsolute
        handleSelectRelative={handleSelectRelative}
        relativePeriods={{
          '1h': 'Last hour',
          '24h': 'Last 24 hours',
          '7d': 'Last 7 days',
          '14d': 'Last 14 days',
          '30d': 'Last 30 days',
        }}
      >
        {items => (
          <div>
            {items.map(item => (
              <div key={item.value}>{item.label}</div>
            ))}
          </div>
        )}
      </DisabledSelectorItems>,
      {organization}
    );

    expect(screen.getByText('Last hour')).toBeInTheDocument();
    expect(screen.getByText('Last 24 hours')).toBeInTheDocument();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Last 14 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();

    // 90 days is not provided as an option so do not include the upsell
    expect(screen.queryByText('Last 90 days')).not.toBeInTheDocument();
    expect(screen.queryByText(/Start Trial/)).not.toBeInTheDocument();
  });
});
