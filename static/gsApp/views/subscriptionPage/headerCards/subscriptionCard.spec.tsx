import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SubscriptionCard} from './subscriptionCard';

describe('SubscriptionCard', () => {
  const organization = OrganizationFixture({access: ['org:billing']});

  it('should render plan name, next renewal date, card info', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_team',
      contractPeriodEnd: moment().add(1, 'month').toISOString(),
    });

    render(<SubscriptionCard organization={organization} subscription={subscription} />);

    expect(screen.getByRole('img', {name: 'Team logo'})).toBeInTheDocument();
    expect(screen.getByText('Team Plan')).toBeInTheDocument();
    expect(screen.getByText('($29/mo)')).toBeInTheDocument();
    // Renews in xyz days, changes based on the frozen test date
    expect(screen.getByText(/Renews on:/)).toBeInTheDocument();

    // Card info
    expect(screen.getByText('CC: **** 4242')).toBeInTheDocument();
    expect(screen.getByText('Exp: 12/77')).toBeInTheDocument();
  });

  it('should render past due', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_team',
      // Indicates an issue with payment
      isPastDue: true,
    });

    render(<SubscriptionCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('Payment Failed')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Manage Billing Details'})
    ).toBeInTheDocument();
  });

  it('should render no credit card', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_team',
      paymentSource: null,
    });

    render(<SubscriptionCard organization={organization} subscription={subscription} />);

    expect(screen.getByText(/No Card on File/)).toBeInTheDocument();
  });

  it('should not show No Card on File for VC partner accounts', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am3',
      plan: 'am3_team',
      paymentSource: null,
      partner: {
        externalId: 'x123x',
        name: 'Org',
        partnership: {
          id: 'VC',
          displayName: 'XX',
          supportNote: '',
        },
        isActive: true,
      },
    });

    render(<SubscriptionCard organization={organization} subscription={subscription} />);

    expect(screen.queryByText(/No Card on File/)).not.toBeInTheDocument();
  });

  it('should render annual subscription', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      // Is an annual plan
      plan: 'am2_team_auf',
    });

    render(<SubscriptionCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('($312/yr)')).toBeInTheDocument();
  });

  it('should render developer plan', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_f',
    });

    render(<SubscriptionCard organization={organization} subscription={subscription} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('($0)')).toBeInTheDocument();
  });

  it('hides credit card info if user does not have billing access', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_team',
    });

    render(
      <SubscriptionCard
        organization={{...organization, access: []}}
        subscription={subscription}
      />
    );

    expect(screen.getByRole('img', {name: 'Team logo'})).toBeInTheDocument();
    expect(screen.queryByText(/4242/)).not.toBeInTheDocument();
  });
});
