import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {PlanTier} from 'getsentry/types';

import OnDemandDisabled from './ondemandDisabled';

describe('OnDemandDisabled', function () {
  const organization = OrganizationFixture();

  it('renders nothing when onDemandDisabled is false', function () {
    const subscription = SubscriptionFixture({
      organization,
      onDemandDisabled: false,
      onDemandMaxSpend: 1000,
    });

    render(<OnDemandDisabled subscription={subscription} />);

    expect(screen.queryByTestId('ondemand-disabled-alert')).not.toBeInTheDocument();
  });

  it('renders nothing when onDemandMaxSpend is 0', function () {
    const subscription = SubscriptionFixture({
      organization,
      onDemandDisabled: true,
      onDemandMaxSpend: 0,
    });

    render(<OnDemandDisabled subscription={subscription} />);

    expect(screen.queryByTestId('ondemand-disabled-alert')).not.toBeInTheDocument();
  });

  it('renders alert for AM1 plan with on-demand terminology', function () {
    const subscription = SubscriptionFixture({
      organization,
      onDemandDisabled: true,
      onDemandMaxSpend: 1000,
      planTier: PlanTier.AM1,
    });

    render(<OnDemandDisabled subscription={subscription} />);

    expect(screen.getByTestId('ondemand-disabled-alert')).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'On-demand billing is disabled for your organization due to an unpaid on-demand invoice.'
        )
      )
    ).toBeInTheDocument();
  });

  it('renders alert for AM2 plan with on-demand terminology', function () {
    const subscription = SubscriptionFixture({
      organization,
      onDemandDisabled: true,
      onDemandMaxSpend: 1000,
      planTier: PlanTier.AM2,
    });

    render(<OnDemandDisabled subscription={subscription} />);

    expect(screen.getByTestId('ondemand-disabled-alert')).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'On-demand billing is disabled for your organization due to an unpaid on-demand invoice.'
        )
      )
    ).toBeInTheDocument();
  });

  it('renders alert for AM3 plan with pay-as-you-go terminology', function () {
    const subscription = SubscriptionFixture({
      organization,
      onDemandDisabled: true,
      onDemandMaxSpend: 1000,
      planTier: PlanTier.AM3,
    });

    render(<OnDemandDisabled subscription={subscription} />);

    expect(screen.getByTestId('ondemand-disabled-alert')).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'Pay-as-you-go billing is disabled for your organization due to an unpaid pay-as-you-go invoice.'
        )
      )
    ).toBeInTheDocument();
  });

  it('includes links to receipts, support email and documentation', function () {
    const subscription = SubscriptionFixture({
      organization,
      onDemandDisabled: true,
      onDemandMaxSpend: 1000,
    });

    render(<OnDemandDisabled subscription={subscription} />);

    expect(screen.getByRole('link', {name: 'outstanding invoices'})).toHaveAttribute(
      'href',
      '/settings/billing/receipts/'
    );
    expect(screen.getByRole('link', {name: 'support@sentry.io'})).toHaveAttribute(
      'href',
      'mailto:support@sentry.io'
    );
    expect(
      screen.getByRole('link', {name: 'Learn more about this process'})
    ).toHaveAttribute(
      'href',
      'https://sentry.zendesk.com/hc/en-us/articles/23622477256987-We-can-t-pay-our-on-demand-pay-as-you-go-invoice-and-have-an-annual-contract-What-happens'
    );
  });
});
