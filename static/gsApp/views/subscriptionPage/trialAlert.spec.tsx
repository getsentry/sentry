import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import TrialAlert from 'getsentry/views/subscriptionPage/trialAlert';

describe('Subscription > TrialAlert', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  beforeEach(() =>
    jest.spyOn(Date, 'now').mockImplementation(() => new Date('2021-01-01').getTime())
  );

  it('does not render not on trial', function () {
    const sub = {
      ...subscription,
      isTrial: false,
      onDemandMaxSpend: 1000,
      onDemandSpendUsed: 0,
    };
    render(<TrialAlert subscription={sub} organization={organization} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders 1 day left', function () {
    const sub = {
      ...subscription,
      isTrial: true,
      onDemandMaxSpend: 1000,
      onDemandSpendUsed: 0,
      trialEnd: '2021-01-02',
    };
    render(<TrialAlert subscription={sub} organization={organization} />);
    expect(screen.getByText('1 Day Left')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders 14 days left', function () {
    const sub = {
      ...subscription,
      isTrial: true,
      onDemandMaxSpend: 1000,
      onDemandSpendUsed: 0,
      trialEnd: '2021-01-15',
    };
    render(<TrialAlert subscription={sub} organization={organization} />);
    expect(screen.getByText('14 Days Left')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not render negative days left', function () {
    const sub = {
      ...subscription,
      isTrial: true,
      onDemandMaxSpend: 1000,
      onDemandSpendUsed: 0,
      trialEnd: '2020-12-01',
    };
    render(<TrialAlert subscription={sub} organization={organization} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders enterprise trial', function () {
    const sub = {
      ...subscription,
      isTrial: true,
      isEnterpriseTrial: true,
      onDemandMaxSpend: 1000,
      onDemandSpendUsed: 0,
    };
    render(<TrialAlert subscription={sub} organization={organization} />);
    expect(screen.getByText('Enterprise Trial')).toBeInTheDocument();
    expect(
      screen.getByText(
        "With your trial you have access to Sentry's business plan features, and unlimited errors, transactions, replays, attachments, cron monitors, and uptime monitors."
      )
    ).toBeInTheDocument();
  });

  it('renders am3 enterprise trial', function () {
    const am3_sub = SubscriptionFixture({organization, plan: 'am3_f'});
    const sub = {
      ...am3_sub,
      isTrial: true,
      isEnterpriseTrial: true,
      onDemandMaxSpend: 1000,
      onDemandSpendUsed: 0,
    };
    render(<TrialAlert subscription={sub} organization={organization} />);
    expect(screen.getByText('Enterprise Trial')).toBeInTheDocument();
    expect(
      screen.getByText(
        "With your trial you have access to Sentry's business plan features, and unlimited errors, replays, attachments, cron monitors, spans, profile hours, and uptime monitors."
      )
    ).toBeInTheDocument();
  });

  it('renders plan trial', function () {
    const sub = {
      ...subscription,
      isTrial: true,
      isEnterpriseTrial: false,
      isPerformancePlanTrial: false,
      onDemandMaxSpend: 1000,
      onDemandSpendUsed: 0,
    };
    render(<TrialAlert subscription={sub} organization={organization} />);
    expect(screen.getByText('Business Plan Trial')).toBeInTheDocument();
    expect(
      screen.getByText(
        "With your trial you have access to Sentry's business plan features."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/unlimited errors/)).not.toBeInTheDocument();
  });

  it('renders performance trial', function () {
    const sub = {
      ...subscription,
      isTrial: true,
      isEnterpriseTrial: false,
      isPerformancePlanTrial: true,
      onDemandMaxSpend: 1000,
      onDemandSpendUsed: 0,
    };
    render(<TrialAlert subscription={sub} organization={organization} />);
    expect(screen.getByText('Performance Trial')).toBeInTheDocument();
    expect(
      screen.getByText(
        `With your trial you have access to Sentry's performance features, and unlimited transactions and attachments.`
      )
    ).toBeInTheDocument();
  });
});
