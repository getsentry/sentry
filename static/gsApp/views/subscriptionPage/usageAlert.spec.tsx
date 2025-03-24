import {OrganizationFixture} from 'sentry-fixture/organization';

import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {UsageTotalFixture} from 'getsentry-test/fixtures/usageTotal';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {DataCategory} from 'sentry/types/core';

import {GIGABYTE} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import UsageAlert from 'getsentry/views/subscriptionPage/usageAlert';

describe('Subscription > UsageAlert', function () {
  const emptyUsage = CustomerUsageFixture();

  it('does not render without overage', function () {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({organization, canTrial: false});

    render(<UsageAlert subscription={subscription} usage={emptyUsage} />, {});

    expect(screen.queryByTestId('usage-alert')).not.toBeInTheDocument();
  });

  it('renders request add events CTA if am1 business and a member', function () {
    const organization = OrganizationFixture({access: []});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      canSelfServe: true,
    });

    SubscriptionStore.set(organization.slug, subscription);
    render(<UsageAlert subscription={subscription} usage={emptyUsage} />, {
      organization,
    });

    expect(screen.queryByTestId('usage-alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Request Additional Quota')).toBeInTheDocument();
  });

  it('renders an upgrade CTA for mm2_b usage exceeded', function () {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_b_100k',
      usageExceeded: true,
      // TODO: Add "categories" when mmx plans have error BillingMetricHistory
    });

    render(<UsageAlert subscription={subscription} usage={emptyUsage} />, {
      organization,
    });

    expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
    expect(screen.getByText('Usage Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/errors capacity/))
    ).toBeInTheDocument();
    expect(screen.queryByText('grace period')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Upgrade Plan')).toBeInTheDocument();

    expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
  });

  it('renders am1_f usage exceeded errors with trial', function () {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      usageExceeded: false,
      categories: {
        errors: MetricHistoryFixture({usageExceeded: true}),
      },
      canTrial: true,
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<UsageAlert subscription={subscription} usage={emptyUsage} />, {
      organization,
    });

    expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
    expect(screen.getByText('Usage Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/errors capacity/))
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Start Trial')).toBeInTheDocument();

    expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
  });

  it('renders am1 usage exceeded errors and transactions request add events', function () {
    const organization = OrganizationFixture({access: []});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      usageExceeded: false,
      categories: {
        errors: MetricHistoryFixture({
          category: DataCategory.ERRORS,
          usageExceeded: true,
        }),
        transactions: MetricHistoryFixture({
          usageExceeded: true,
          category: DataCategory.TRANSACTIONS,
        }),
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<UsageAlert subscription={subscription} usage={emptyUsage} />, {
      organization,
    });

    expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
    expect(screen.getByText('Usage Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/errors and transactions capacity/))
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Request Additional Quota')).toBeInTheDocument();

    expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
  });

  it('renders am2 usage exceeded errors and transactions request add events', function () {
    const organization = OrganizationFixture({access: []});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      usageExceeded: false,
      categories: {
        errors: MetricHistoryFixture({
          usageExceeded: true,
          category: DataCategory.ERRORS,
        }),
        transactions: MetricHistoryFixture({
          usageExceeded: true,
          category: DataCategory.ATTACHMENTS,
        }),
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<UsageAlert subscription={subscription} usage={emptyUsage} />, {
      organization,
    });

    expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
    expect(screen.getByText('Usage Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/errors and performance units capacity/))
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Request Additional Quota')).toBeInTheDocument();

    expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
  });

  it('renders am1 usage exceeded errors and attachments add events', function () {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      usageExceeded: false,
      categories: {
        errors: MetricHistoryFixture({
          usageExceeded: true,
          category: DataCategory.ERRORS,
        }),
        transactions: MetricHistoryFixture({
          usageExceeded: false,
          category: DataCategory.TRANSACTIONS,
        }),
        attachments: MetricHistoryFixture({
          usageExceeded: true,
          category: DataCategory.ATTACHMENTS,
        }),
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<UsageAlert subscription={subscription} usage={emptyUsage} />, {
      organization,
    });

    expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
    expect(screen.getByText('Usage Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/errors and attachments capacity/))
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Increase Reserved Limits')).toBeInTheDocument();

    expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
  });

  it('renders am1 all data categories exceeded request upgrade', function () {
    const organization = OrganizationFixture({access: []});
    const plan_id = 'am1_f';
    const planDetails = PlanDetailsLookupFixture(plan_id)!;
    const subCategories = {};

    planDetails.categories.forEach(category => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      subCategories[category] = MetricHistoryFixture({
        usageExceeded: true,
        category,
      });
    });

    const subscription = SubscriptionFixture({
      organization,
      plan: plan_id,
      usageExceeded: true,
      categories: subCategories,
      canTrial: false,
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<UsageAlert subscription={subscription} usage={emptyUsage} />, {
      organization,
    });

    expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
    expect(screen.getByText('Usage Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /errors, transactions, replays, cron monitors, and attachments capacity/
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Request Upgrade')).toBeInTheDocument();

    expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
  });

  it('renders am2 all data categories exceeded request upgrade', function () {
    const organization = OrganizationFixture({access: []});
    const plan_id = 'am2_f';
    const planDetails = PlanDetailsLookupFixture(plan_id)!;
    const subCategories = {};

    planDetails.categories.forEach(category => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      subCategories[category] = MetricHistoryFixture({
        usageExceeded: true,
        category,
      });
    });

    const subscription = SubscriptionFixture({
      organization,
      plan: plan_id,
      usageExceeded: true,
      categories: subCategories,
      canTrial: false,
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<UsageAlert subscription={subscription} usage={emptyUsage} />, {
      organization,
    });

    expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
    expect(screen.getByText('Usage Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /errors, performance units, replays, cron monitors, and attachments capacity/
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Request Upgrade')).toBeInTheDocument();

    expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
  });

  it('renders am3 all data categories exceeded request upgrade', function () {
    const organization = OrganizationFixture({access: []});
    const plan_id = 'am3_f';
    const planDetails = PlanDetailsLookupFixture(plan_id)!;
    const subCategories = {};

    planDetails.categories.forEach(category => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      subCategories[category] = MetricHistoryFixture({
        usageExceeded: true,
        category,
      });
    });

    const subscription = SubscriptionFixture({
      organization,
      plan: plan_id,
      usageExceeded: true,
      categories: subCategories,
      canTrial: false,
    });

    SubscriptionStore.set(organization.slug, subscription);

    render(<UsageAlert subscription={subscription} usage={emptyUsage} />, {
      organization,
    });

    expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
    expect(screen.getByText('Usage Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /errors, replays, spans, cron monitors, and attachments capacity/
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Request Upgrade')).toBeInTheDocument();

    expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
  });

  describe('grace period', function () {
    it('renders for grace period', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({organization, canTrial: false});

      render(
        <UsageAlert
          subscription={{...subscription, isGracePeriod: true}}
          usage={emptyUsage}
        />,
        {organization}
      );

      expect(screen.getByTestId('grace-period-alert')).toBeInTheDocument();
      expect(screen.getByText('Grace Period')).toBeInTheDocument();
      expect(screen.getByLabelText('Upgrade Plan')).toBeInTheDocument();

      expect(screen.queryByTestId('usage-exceeded-alert')).not.toBeInTheDocument();
      expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
    });

    it('renders for grace period and transactions exceeded', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({organization, canTrial: false});

      render(
        <UsageAlert
          subscription={{
            ...subscription,
            isGracePeriod: true,
            categories: {
              transactions: MetricHistoryFixture({usageExceeded: true}),
            },
          }}
          usage={emptyUsage}
        />,
        {organization}
      );

      expect(screen.getByTestId('grace-period-alert')).toBeInTheDocument();
      expect(screen.getByText('Grace Period')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Upgrade Plan')).toHaveLength(2);

      expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/transactions capacity/))
      ).toBeInTheDocument();

      expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
    });

    it('renders for am2 grace period and transactions exceeded', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({
        plan: 'am2_f',
        organization,
        canTrial: false,
      });

      render(
        <UsageAlert
          subscription={{
            ...subscription,
            isGracePeriod: true,
            categories: {
              transactions: MetricHistoryFixture({usageExceeded: true}),
            },
          }}
          usage={emptyUsage}
        />,
        {organization}
      );

      expect(screen.getByTestId('grace-period-alert')).toBeInTheDocument();
      expect(screen.getByText('Grace Period')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Upgrade Plan')).toHaveLength(2);

      expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/performance units capacity/))
      ).toBeInTheDocument();

      expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
    });

    it('does not render upgrade buttons if cannot self-serve', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({organization, canTrial: false});

      render(
        <UsageAlert
          subscription={{
            ...subscription,
            canSelfServe: false,
            categories: {
              errors: MetricHistoryFixture({usageExceeded: true}),
              transactions: MetricHistoryFixture({
                category: DataCategory.TRANSACTIONS,
              }),
              attachments: MetricHistoryFixture({
                category: DataCategory.ATTACHMENTS,
              }),
            },
          }}
          usage={emptyUsage}
        />,
        {organization}
      );

      expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
      expect(screen.queryByLabelText('Upgrade Plan')).not.toBeInTheDocument();
    });
  });

  describe('projected overage', function () {
    it('renders am1 usage exceeded errors with projected overage', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({organization, canTrial: false});

      render(
        <UsageAlert
          subscription={{
            ...subscription,
            plan: 'am1_f',
            usageExceeded: false,
            categories: {
              errors: MetricHistoryFixture({
                usageExceeded: true,
                prepaid: 5_000,
                reserved: 5_000,
              }),
            },
          }}
          usage={CustomerUsageFixture({
            totals: {
              errors: UsageTotalFixture({accepted: 3_000, projected: 7_000}),
            },
          })}
        />,
        {organization}
      );

      expect(screen.getByTestId('usage-exceeded-alert')).toBeInTheDocument();
      expect(screen.getByText('Usage Exceeded')).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/errors capacity/))
      ).toBeInTheDocument();

      expect(screen.getByLabelText('Upgrade Plan')).toBeInTheDocument();

      expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
      expect(screen.queryByTestId('projected-overage-alert')).not.toBeInTheDocument();
    });

    it('renders am1 with projected errors overage', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({organization, canTrial: false});

      render(
        <UsageAlert
          subscription={{
            ...subscription,
            plan: 'am1_f',
            reservedErrors: 5000,
            categories: {
              errors: MetricHistoryFixture({prepaid: 5_000, reserved: 5_000}),
            },
          }}
          usage={CustomerUsageFixture({
            totals: {
              errors: UsageTotalFixture({accepted: 3_000, projected: 10_000}),
            },
          })}
        />,
        {organization}
      );

      expect(screen.getByTestId('projected-overage-alert')).toBeInTheDocument();
      expect(screen.getByText('Projected Overage')).toBeInTheDocument();
      expect(screen.getByText(/will need at least 10K errors/)).toBeInTheDocument();
      expect(screen.getByLabelText('Upgrade Plan')).toBeInTheDocument();

      expect(screen.queryByTestId('usage-exceeded-alert')).not.toBeInTheDocument();
      expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    });

    it('does not render without projected errors overage', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({organization, canTrial: false});

      render(
        <UsageAlert
          subscription={{
            ...subscription,
            plan: 'am1_f',
            categories: {
              errors: MetricHistoryFixture({prepaid: 100_000, reserved: 100_000}),
            },
          }}
          usage={CustomerUsageFixture({
            totals: {
              errors: UsageTotalFixture({accepted: 3_000, projected: 7_000}),
            },
          })}
        />,
        {organization}
      );

      expect(screen.queryByTestId('usage-alert')).not.toBeInTheDocument();
    });

    it('renders am1 with projected errors and transactions overage', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({organization, canTrial: false});

      render(
        <UsageAlert
          subscription={{
            ...subscription,
            categories: {
              errors: MetricHistoryFixture({
                prepaid: 5_000,
                reserved: 5_000,
                category: DataCategory.ERRORS,
              }),
              transactions: MetricHistoryFixture({
                category: DataCategory.TRANSACTIONS,
                prepaid: 10_000,
                reserved: 10_000,
              }),
              attachments: MetricHistoryFixture({
                category: DataCategory.ATTACHMENTS,
              }),
            },
          }}
          usage={CustomerUsageFixture({
            totals: {
              errors: UsageTotalFixture({accepted: 1_000, projected: 10_000}),
              transactions: UsageTotalFixture({accepted: 3_000, projected: 20_000}),
            },
          })}
        />,
        {organization}
      );

      expect(screen.getByTestId('projected-overage-alert')).toBeInTheDocument();
      expect(screen.getByText('Projected Overage')).toBeInTheDocument();
      expect(
        screen.getByText(/will need at least 10K errors and 20K transactions/)
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Upgrade Plan')).toBeInTheDocument();

      expect(screen.queryByTestId('usage-exceeded-alert')).not.toBeInTheDocument();
      expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    });

    it('renders am2 with projected errors and transactions overage', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({
        plan: 'am2_f',
        organization,
        canTrial: false,
      });

      render(
        <UsageAlert
          subscription={{
            ...subscription,
            categories: {
              errors: MetricHistoryFixture({
                prepaid: 5_000,
                reserved: 5_000,
                category: DataCategory.ERRORS,
              }),
              transactions: MetricHistoryFixture({
                category: DataCategory.TRANSACTIONS,
                prepaid: 10_000,
                reserved: 10_000,
              }),
              attachments: MetricHistoryFixture({
                category: DataCategory.ATTACHMENTS,
              }),
            },
          }}
          usage={CustomerUsageFixture({
            totals: {
              errors: UsageTotalFixture({accepted: 1_000, projected: 10_000}),
              transactions: UsageTotalFixture({accepted: 3_000, projected: 20_000}),
            },
          })}
        />,
        {organization}
      );

      expect(screen.getByTestId('projected-overage-alert')).toBeInTheDocument();
      expect(screen.getByText('Projected Overage')).toBeInTheDocument();
      expect(
        screen.getByText(/will need at least 10K errors and 20K performance units/)
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Upgrade Plan')).toBeInTheDocument();

      expect(screen.queryByTestId('usage-exceeded-alert')).not.toBeInTheDocument();
      expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    });

    it('renders am1 with projected attachments overage', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({organization, canTrial: false});

      render(
        <UsageAlert
          subscription={{
            ...subscription,
            plan: 'am1_f',
            categories: {
              attachments: MetricHistoryFixture({prepaid: 1, reserved: 1}),
            },
          }}
          usage={CustomerUsageFixture({
            totals: {
              attachments: UsageTotalFixture({
                accepted: GIGABYTE * 0.5,
                projected: GIGABYTE * 5,
              }),
            },
          })}
        />,
        {organization}
      );

      expect(screen.getByTestId('projected-overage-alert')).toBeInTheDocument();
      expect(screen.getByText('Projected Overage')).toBeInTheDocument();
      expect(
        screen.getByText(/will need at least 5 GB of attachments/)
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Upgrade Plan')).toBeInTheDocument();

      expect(screen.queryByTestId('usage-exceeded-alert')).not.toBeInTheDocument();
      expect(screen.queryByTestId('grace-period-alert')).not.toBeInTheDocument();
    });

    it('does not render without projected attachments overage', function () {
      const organization = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({organization, canTrial: false});

      render(
        <UsageAlert
          subscription={{
            ...subscription,
            plan: 'am1_f',
            categories: {
              attachments: MetricHistoryFixture({prepaid: 5, reserved: 5}),
            },
          }}
          usage={CustomerUsageFixture({
            totals: {
              attachments: UsageTotalFixture({
                accepted: GIGABYTE * 40,
                projected: GIGABYTE * 4,
              }),
            },
          })}
        />,
        {organization}
      );

      expect(screen.queryByTestId('usage-alert')).not.toBeInTheDocument();
    });
  });
});
