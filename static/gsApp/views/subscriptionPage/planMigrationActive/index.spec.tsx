import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {PlanMigrationFixture} from 'getsentry-test/fixtures/planMigration';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ANNUAL} from 'getsentry/constants';
import {CohortId} from 'getsentry/types';
import PlanMigrationActive from 'getsentry/views/subscriptionPage/planMigrationActive/index';

describe('PlanMigrationActive cohort 2', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    plan: 'mm2_b_100k',
    reservedEvents: 100000,
    organization,
  });
  const renewalDate = moment(subscription.contractPeriodEnd).add(1, 'days').format('ll');
  const migration = PlanMigrationFixture({
    cohortId: CohortId.SECOND,
    effectiveAt: renewalDate,
  });

  function renderSimple() {
    render(<PlanMigrationActive migration={migration} subscription={subscription} />);
  }

  it('renders with active migration', function () {
    renderSimple();

    expect(screen.getByTestId('plan-migration-panel')).toBeInTheDocument();
    expect(screen.getByText("We're updating our Team Plan")).toBeInTheDocument();
    expect(
      screen.getByText('These plan changes will take place on Oct 25, 2018.')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Performance Monitoring')).toHaveLength(2);
    expect(screen.getByText('Event Attachments')).toBeInTheDocument();
    expect(screen.getByText('Stack Trace Linking')).toBeInTheDocument();
    expect(screen.getByText('And more...')).toBeInTheDocument();
    expect(screen.getByText(renewalDate, {exact: false})).toBeInTheDocument();
  });

  it('renders null', function () {
    render(<PlanMigrationActive migration={undefined} subscription={subscription} />);
    expect(screen.queryByTestId('plan-migration-panel')).not.toBeInTheDocument();
  });

  it('renders null with missing next plan', function () {
    render(
      <PlanMigrationActive
        migration={PlanMigrationFixture({
          cohortId: CohortId.SECOND,
          cohort: {cohortId: CohortId.SECOND, nextPlan: null, secondDiscount: 0},
        })}
        subscription={subscription}
      />
    );
    expect(screen.queryByTestId('plan-migration-panel')).not.toBeInTheDocument();
  });

  it('renders plan migration table', function () {
    renderSimple();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('renders plan row', function () {
    renderSimple();
    expect(screen.getByTestId('current-plan')).toHaveTextContent(/Legacy Team/);
    expect(screen.getByTestId('new-plan')).toHaveTextContent(/Team/);
  });

  it('does not render contract row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-contract')).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-contract')).not.toBeInTheDocument();
  });

  it('renders price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-price')).toHaveTextContent(/\$29/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$44/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$29\*/);
  });

  it('renders errors row', function () {
    renderSimple();
    expect(screen.getByTestId('current-errors')).toHaveTextContent(/100K/);
    expect(screen.getByTestId('new-errors')).toHaveTextContent(/100K/);
  });

  it('renders transactions row', function () {
    renderSimple();
    expect(screen.getByTestId('current-transactions')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-transactions')).toHaveTextContent(/100K/);
  });

  it('renders attachments row', function () {
    renderSimple();
    expect(screen.getByTestId('current-attachments')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-attachments')).toHaveTextContent(/1 GB/);
  });

  it('renders discount note', function () {
    renderSimple();
    expect(screen.getByTestId('dollar-credits')).toHaveTextContent(
      /\*\$29 for 5 months, then changes to \$44 per month on Mar 25, 2019\./
    );
  });
});

describe('PlanMigrationActive cohort 3', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    plan: 'mm2_b_100k_ac',
    reservedEvents: 100000,
    organization,
  });
  const renewalDate = moment(subscription.contractPeriodEnd).add(1, 'days').format('ll');
  const migration = PlanMigrationFixture({
    cohortId: CohortId.THIRD,
    effectiveAt: renewalDate,
  });

  function renderSimple() {
    render(<PlanMigrationActive migration={migration} subscription={subscription} />);
  }

  it('renders with active migration', function () {
    renderSimple();

    expect(screen.getByTestId('plan-migration-panel')).toBeInTheDocument();
    expect(screen.getByText("We're updating our Team Plan")).toBeInTheDocument();
    expect(screen.getAllByText('Performance Monitoring')).toHaveLength(2);
    expect(screen.getByText('Event Attachments')).toBeInTheDocument();
    expect(screen.getByText('Stack Trace Linking')).toBeInTheDocument();
    expect(screen.getByText('And more...')).toBeInTheDocument();
    expect(screen.getByText(renewalDate, {exact: false})).toBeInTheDocument();
  });

  it('renders null', function () {
    render(<PlanMigrationActive migration={undefined} subscription={subscription} />);
    expect(screen.queryByTestId('plan-migration-panel')).not.toBeInTheDocument();
  });

  it('renders null with missing next plan', function () {
    render(
      <PlanMigrationActive
        migration={PlanMigrationFixture({
          cohortId: CohortId.THIRD,
          cohort: {cohortId: CohortId.THIRD, nextPlan: null, secondDiscount: 0},
        })}
        subscription={subscription}
      />
    );
    expect(screen.queryByTestId('plan-migration-panel')).not.toBeInTheDocument();
  });

  it('renders plan migration table', function () {
    renderSimple();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(7);
  });

  it('renders plan row', function () {
    renderSimple();
    expect(screen.getByTestId('current-plan')).toHaveTextContent(/Legacy Team/);
    expect(screen.getByTestId('new-plan')).toHaveTextContent(/Team/);
  });

  it('renders contract row', function () {
    renderSimple();
    expect(screen.getByTestId('current-contract')).toHaveTextContent(/annual/);
    expect(screen.getByTestId('new-contract')).toHaveTextContent(/monthly/);
  });

  it('renders price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-price')).toHaveTextContent(/\$26/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$44/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$26/);
  });

  it('renders errors row', function () {
    renderSimple();
    expect(screen.getByTestId('current-errors')).toHaveTextContent(/100K/);
    expect(screen.getByTestId('new-errors')).toHaveTextContent(/100K/);
  });

  it('renders transactions row', function () {
    renderSimple();
    expect(screen.getByTestId('current-transactions')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-transactions')).toHaveTextContent(/100K/);
  });

  it('renders attachments row', function () {
    renderSimple();
    expect(screen.getByTestId('current-attachments')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-attachments')).toHaveTextContent(/1 GB/);
  });

  it('renders dollar credits note', function () {
    renderSimple();
    expect(screen.getByTestId('dollar-credits')).toHaveTextContent(
      /\*\$26 for 5 months, then changes to \$44 per month on Mar 25, 2019\./
    );
  });
});

describe('PlanMigrationActive cohort 4', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    plan: 'mm2_b_100k_auf',
    reservedEvents: 100000,
    billingInterval: 'annual',
    organization,
  });
  const migrationDate = moment().add(1, 'days').format('ll');
  const migration = PlanMigrationFixture({
    cohortId: CohortId.FOURTH,
    effectiveAt: migrationDate,
  });

  function renderSimple() {
    render(<PlanMigrationActive migration={migration} subscription={subscription} />);
  }

  it('renders with active migration', function () {
    renderSimple();

    expect(screen.getByTestId('plan-migration-panel')).toBeInTheDocument();
    expect(screen.getByText("We're updating our Team Plan")).toBeInTheDocument();
    expect(screen.getAllByText('Performance Monitoring')).toHaveLength(2);
    expect(screen.getByText('Event Attachments')).toBeInTheDocument();
    expect(screen.getByText('Stack Trace Linking')).toBeInTheDocument();
    expect(screen.getByText('And more...')).toBeInTheDocument();
    expect(screen.getAllByText(migrationDate, {exact: false})).toHaveLength(2);
  });

  it('renders plan migration table', function () {
    renderSimple();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(7);
  });

  it('renders plan row', function () {
    renderSimple();
    expect(screen.getByTestId('current-plan')).toHaveTextContent(/Legacy Team/);
    expect(screen.getByTestId('new-plan')).toHaveTextContent(/Team/);
  });

  it('does not render contract row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-contract')).not.toBeInTheDocument();
  });

  it('renders price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-price')).toHaveTextContent(/\$312/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$480/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$312/);
  });

  it('renders renewal price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-renewal')).toHaveTextContent(/\$312/);
    expect(screen.getByTestId('new-renewal')).toHaveTextContent(/\$480/);
    expect(screen.getByTestId('new-renewal')).toHaveTextContent(/\$452/);
  });

  it('renders errors row', function () {
    renderSimple();
    expect(screen.getByTestId('current-errors')).toHaveTextContent(/100K/);
    expect(screen.getByTestId('new-errors')).toHaveTextContent(/100K/);
  });

  it('renders transactions row', function () {
    renderSimple();
    expect(screen.getByTestId('current-transactions')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-transactions')).toHaveTextContent(/100K/);
  });

  it('renders attachments row', function () {
    renderSimple();
    expect(screen.getByTestId('current-attachments')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-attachments')).toHaveTextContent(/1 GB/);
  });

  it('renders annual dollar credits note', function () {
    renderSimple();
    expect(screen.getByTestId('annual-dollar-credits')).toHaveTextContent(
      /\*Discount of \$168 for plan changes on Oct 18, 2017. An additional one-time \$28 discount applies at contract renewal on Oct 25, 2018\./
    );
  });
});

describe('PlanMigrationActive cohort 5', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    plan: 'm1',
    reservedEvents: 1_000_000,
    organization,
  });
  const renewalDate = moment(subscription.contractPeriodEnd).add(1, 'days').format('ll');
  const migration = PlanMigrationFixture({
    cohortId: CohortId.FIFTH,
    effectiveAt: renewalDate,
  });

  function renderSimple() {
    render(<PlanMigrationActive migration={migration} subscription={subscription} />);
  }

  it('renders with active migration', function () {
    renderSimple();

    expect(screen.getByTestId('plan-migration-panel')).toBeInTheDocument();
    expect(screen.getByText("We're updating our Medium Plan")).toBeInTheDocument();
    expect(
      screen.getByText('These plan changes will take place on Oct 25, 2018.')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Performance Monitoring')).toHaveLength(2);
    expect(screen.getByText('Event Attachments')).toBeInTheDocument();
    expect(screen.getByText('Stack Trace Linking')).toBeInTheDocument();
    expect(screen.getByText('And more...')).toBeInTheDocument();
    expect(screen.getByText(renewalDate, {exact: false})).toBeInTheDocument();
  });

  it('renders plan migration table', function () {
    renderSimple();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('renders plan row', function () {
    renderSimple();
    expect(screen.getByTestId('current-plan')).toHaveTextContent(/Medium/);
    expect(screen.getByTestId('new-plan')).toHaveTextContent(/Business/);
  });

  it('does not render contract row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-contract')).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-contract')).not.toBeInTheDocument();
  });

  it('renders price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-price')).toHaveTextContent(/\$199/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$484/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$199\*/);
  });

  it('renders errors row', function () {
    renderSimple();
    expect(screen.getByTestId('current-errors')).toHaveTextContent(/1M/);
    expect(screen.getByTestId('new-errors')).toHaveTextContent(/1M/);
  });

  it('renders transactions row', function () {
    renderSimple();
    expect(screen.getByTestId('current-transactions')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-transactions')).toHaveTextContent(/100K/);
  });

  it('renders attachments row', function () {
    renderSimple();
    expect(screen.getByTestId('current-attachments')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-attachments')).toHaveTextContent(/1 GB/);
  });

  it('renders discount note', function () {
    renderSimple();
    expect(screen.getByTestId('dollar-credits')).toHaveTextContent(
      /\*\$199 for 5 months, then changes to \$484 per month on Mar 25, 2019\./
    );
  });
});

describe('PlanMigrationActive cohort 6', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    plan: 's1_ac',
    reservedEvents: 100000,
    organization,
  });
  const renewalDate = moment(subscription.contractPeriodEnd).add(1, 'days').format('ll');
  const migration = PlanMigrationFixture({
    cohortId: CohortId.SIXTH,
    effectiveAt: renewalDate,
  });

  function renderSimple() {
    render(<PlanMigrationActive migration={migration} subscription={subscription} />);
  }

  it('renders with active migration', function () {
    renderSimple();

    expect(screen.getByTestId('plan-migration-panel')).toBeInTheDocument();
    expect(screen.getByText("We're updating our Small Plan")).toBeInTheDocument();
    expect(screen.getAllByText('Performance Monitoring')).toHaveLength(2);
    expect(screen.getByText('Event Attachments')).toBeInTheDocument();
    expect(screen.getByText('Stack Trace Linking')).toBeInTheDocument();
    expect(screen.getByText('And more...')).toBeInTheDocument();
    expect(screen.getByText(renewalDate, {exact: false})).toBeInTheDocument();
  });

  it('renders plan migration table', function () {
    renderSimple();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(7);
  });

  it('renders plan row', function () {
    renderSimple();
    expect(screen.getByTestId('current-plan')).toHaveTextContent(/Small/);
    expect(screen.getByTestId('new-plan')).toHaveTextContent(/Team/);
  });

  it('renders contract row', function () {
    renderSimple();
    expect(screen.getByTestId('current-contract')).toHaveTextContent(/annual/);
    expect(screen.getByTestId('new-contract')).toHaveTextContent(/monthly/);
  });

  it('renders price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-price')).toHaveTextContent(/\$26/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$44/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$26/);
  });

  it('renders errors row', function () {
    renderSimple();
    expect(screen.getByTestId('current-errors')).toHaveTextContent(/100K/);
    expect(screen.getByTestId('new-errors')).toHaveTextContent(/100K/);
  });

  it('renders transactions row', function () {
    renderSimple();
    expect(screen.getByTestId('current-transactions')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-transactions')).toHaveTextContent(/100K/);
  });

  it('renders attachments row', function () {
    renderSimple();
    expect(screen.getByTestId('current-attachments')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-attachments')).toHaveTextContent(/1 GB/);
  });

  it('renders dollar credits note', function () {
    renderSimple();
    expect(screen.getByTestId('dollar-credits')).toHaveTextContent(
      /\*\$26 for 5 months, then changes to \$44 per month on Mar 25, 2019\./
    );
  });
});

describe('PlanMigrationActive cohort 7', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    plan: 'm1_auf',
    reservedEvents: 1_000_000,
    billingInterval: 'annual',
    organization,
  });

  const migrationDate = moment().add(1, 'days').format('ll');
  const migration = PlanMigrationFixture({
    cohortId: CohortId.SEVENTH,
    effectiveAt: migrationDate,
  });

  function renderSimple() {
    render(<PlanMigrationActive migration={migration} subscription={subscription} />);
  }

  it('renders with active migration', function () {
    renderSimple();

    expect(screen.getByTestId('plan-migration-panel')).toBeInTheDocument();
    expect(screen.getByText("We're updating our Medium Plan")).toBeInTheDocument();
    expect(screen.getAllByText('Performance Monitoring')).toHaveLength(2);
    expect(screen.getByText('Event Attachments')).toBeInTheDocument();
    expect(screen.getByText('Stack Trace Linking')).toBeInTheDocument();
    expect(screen.getByText('And more...')).toBeInTheDocument();
    expect(screen.getAllByText(migrationDate, {exact: false})).toHaveLength(2);
  });

  it('renders plan migration table', function () {
    renderSimple();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(7);
  });

  it('renders plan row', function () {
    renderSimple();
    expect(screen.getByTestId('current-plan')).toHaveTextContent(/Medium/);
    expect(screen.getByTestId('new-plan')).toHaveTextContent(/Business/);
  });

  it('does not render contract row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-contract')).not.toBeInTheDocument();
  });

  it('renders price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-price')).toHaveTextContent(/\$2,148/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$5,232/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$2,148/);
  });

  it('renders renewal price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-renewal')).toHaveTextContent(/\$2,148/);
    expect(screen.getByTestId('new-renewal')).toHaveTextContent(/\$5,232/);
    expect(screen.getByTestId('new-renewal')).toHaveTextContent(/\$4,718/);
  });

  it('renders errors row', function () {
    renderSimple();
    expect(screen.getByTestId('current-errors')).toHaveTextContent(/1M/);
    expect(screen.getByTestId('new-errors')).toHaveTextContent(/1M/);
  });

  it('renders transactions row', function () {
    renderSimple();
    expect(screen.getByTestId('current-transactions')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-transactions')).toHaveTextContent(/100K/);
  });

  it('renders attachments row', function () {
    renderSimple();
    expect(screen.getByTestId('current-attachments')).toHaveTextContent(/0/);
    expect(screen.getByTestId('new-attachments')).toHaveTextContent(/1 GB/);
  });

  it('renders annual dollar credits note', function () {
    renderSimple();
    expect(screen.getByTestId('annual-dollar-credits')).toHaveTextContent(
      /\*Discount of \$3,084 for plan changes on Oct 18, 2017. An additional one-time \$514 discount applies at contract renewal on Oct 25, 2018\./
    );
  });
});

describe('PlanMigrationActive cohort 8', function () {
  const organization = OrganizationFixture();
  const am2BusinessPlan = PlanDetailsLookupFixture('am2_business');
  const subscription = SubscriptionFixture({
    planDetails: am2BusinessPlan,
    plan: 'am2_business',
    organization,
    reservedEvents: 100_000,
    reservedErrors: 100_000,
  });
  subscription.categories.errors!.reserved = 100_000; // test that it renders the correct next reserved values even if it's not the base volume

  const migrationDate = moment().add(1, 'days').format('ll');
  const migration = PlanMigrationFixture({
    cohortId: CohortId.EIGHTH,
    effectiveAt: migrationDate,
  });

  function renderSimple() {
    render(<PlanMigrationActive migration={migration} subscription={subscription} />);
  }

  it('renders with active migration', function () {
    renderSimple();

    expect(screen.getByTestId('plan-migration-panel')).toBeInTheDocument();
    expect(screen.getByText("We're updating our Business Plan")).toBeInTheDocument();
    expect(
      screen.getByText('10M spans for easier debugging and performance monitoring')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Simplified, cheaper pay-as-you-go pricing')
    ).toBeInTheDocument();
    expect(screen.getByText('And more...')).toBeInTheDocument();
    expect(screen.getByText(migrationDate, {exact: false})).toBeInTheDocument();
  });

  it('renders plan migration table', function () {
    renderSimple();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(8);
  });

  it('renders plan row', function () {
    renderSimple();
    expect(screen.getByTestId('current-plan')).toHaveTextContent(/Legacy Business/);
    expect(screen.getByTestId('new-plan')).toHaveTextContent(/Business/);
  });

  it('does not render contract row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-contract')).not.toBeInTheDocument();
  });

  it('renders price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-price')).toHaveTextContent(/\$89/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$89/);
  });

  it('does not renders renewal price row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-renewal')).not.toBeInTheDocument();
  });

  it('renders errors row', function () {
    renderSimple();
    expect(screen.getByTestId('current-errors')).toHaveTextContent(/100K errors/);
    expect(screen.getByTestId('new-errors')).toHaveTextContent(/100K errors/);
  });

  it('renders spans row', function () {
    renderSimple();
    expect(screen.getByTestId('current-spans')).toHaveTextContent(
      /100K performance units/
    );
    expect(screen.getByTestId('new-spans')).toHaveTextContent(/10M spans/);
  });

  it('renders attachments row', function () {
    renderSimple();
    expect(screen.getByTestId('current-attachments')).toHaveTextContent(/1 GB/);
    expect(screen.getByTestId('new-attachments')).toHaveTextContent(/1 GB/);
  });

  it('renders replays row', function () {
    renderSimple();
    expect(screen.getByTestId('current-replays')).toHaveTextContent(/500 replays/);
    expect(screen.getByTestId('new-replays')).toHaveTextContent(/50 replays/);
  });

  it('renders monitor seats row', function () {
    renderSimple();
    expect(screen.getByTestId('current-monitorSeats')).toHaveTextContent(
      /1 cron monitor/
    );
    expect(screen.getByTestId('new-monitorSeats')).toHaveTextContent(/1 cron monitor/);
  });

  it('does not render profile duration row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-profileDuration')).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-profileDuration')).not.toBeInTheDocument();
  });

  it('does render profile duration row', function () {
    migration.cohort!.nextPlan!.reserved.profileDuration = 1;

    renderSimple();
    expect(screen.queryByTestId('current-profileDuration')).toHaveTextContent(/1 hour/);
    expect(screen.queryByTestId('new-profileDuration')).toHaveTextContent(/1 hour/);
  });

  it('renders replays credit message', function () {
    renderSimple();
    expect(screen.getByTestId('recurring-credits')).toHaveTextContent(
      /\*We'll provide an additional 450 replays for the next 2 monthly usage cycles after your plan is upgraded, at no charge./
    );
  });
});

describe('PlanMigrationActive cohort 9', function () {
  const organization = OrganizationFixture();
  const am2BusinessPlan = PlanDetailsLookupFixture('am2_business_auf');
  const subscription = SubscriptionFixture({
    planDetails: am2BusinessPlan,
    plan: 'am2_business_auf',
    contractInterval: ANNUAL,
    organization,
  });

  const migrationDate = moment().add(1, 'days').format('ll');
  const migration = PlanMigrationFixture({
    cohortId: CohortId.NINTH,
    effectiveAt: migrationDate,
  });

  function renderSimple() {
    render(<PlanMigrationActive migration={migration} subscription={subscription} />);
  }

  it('renders with active migration', function () {
    renderSimple();

    expect(screen.getByTestId('plan-migration-panel')).toBeInTheDocument();
    expect(screen.getByText("We're updating our Business Plan")).toBeInTheDocument();
    expect(
      screen.getByText('10M spans for easier debugging and performance monitoring')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Simplified, cheaper pay-as-you-go pricing')
    ).toBeInTheDocument();
    expect(screen.getByText('And more...')).toBeInTheDocument();
    expect(screen.getByText(migrationDate, {exact: false})).toBeInTheDocument();
  });

  it('renders plan migration table', function () {
    renderSimple();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(8);
  });

  it('renders plan row', function () {
    renderSimple();
    expect(screen.getByTestId('current-plan')).toHaveTextContent(/Legacy Business/);
    expect(screen.getByTestId('new-plan')).toHaveTextContent(/Business/);
  });

  it('does not render contract row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-contract')).not.toBeInTheDocument();
  });

  it('renders price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-price')).toHaveTextContent(/\$960/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$960/);
  });

  it('does not renders renewal price row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-renewal')).not.toBeInTheDocument();
  });

  it('renders errors row', function () {
    renderSimple();
    expect(screen.getByTestId('current-errors')).toHaveTextContent(/50K errors/);
    expect(screen.getByTestId('new-errors')).toHaveTextContent(/50K errors/);
  });

  it('renders spans row', function () {
    renderSimple();
    expect(screen.getByTestId('current-spans')).toHaveTextContent(
      /100K performance units/
    );
    expect(screen.getByTestId('new-spans')).toHaveTextContent(/10M spans/);
  });

  it('renders attachments row', function () {
    renderSimple();
    expect(screen.getByTestId('current-attachments')).toHaveTextContent(/1 GB/);
    expect(screen.getByTestId('new-attachments')).toHaveTextContent(/1 GB/);
  });

  it('renders replays row', function () {
    renderSimple();
    expect(screen.getByTestId('current-replays')).toHaveTextContent(/500 replays/);
    expect(screen.getByTestId('new-replays')).toHaveTextContent(/50 replays/);
  });

  it('renders monitor seats row', function () {
    renderSimple();
    expect(screen.getByTestId('current-monitorSeats')).toHaveTextContent(
      /1 cron monitor/
    );
    expect(screen.getByTestId('new-monitorSeats')).toHaveTextContent(/1 cron monitor/);
  });

  it('renders replays credit message', function () {
    renderSimple();
    expect(screen.getByTestId('recurring-credits')).toHaveTextContent(
      /\*We'll provide an additional 450 replays for the next 2 months following the end of your current annual contract, at no charge./
    );
  });
});

describe('PlanMigrationActive cohort 10', function () {
  const organization = OrganizationFixture();
  const am2BusinessPlan = PlanDetailsLookupFixture('am2_business_auf');
  const subscription = SubscriptionFixture({
    planDetails: am2BusinessPlan,
    plan: 'am2_business_auf',
    contractInterval: ANNUAL,
    organization,
  });

  const migrationDate = moment().add(1, 'days').format('ll');
  const migration = PlanMigrationFixture({
    cohortId: CohortId.TENTH,
    effectiveAt: migrationDate,
  });

  function renderSimple() {
    render(<PlanMigrationActive migration={migration} subscription={subscription} />);
  }

  it('renders with active migration', function () {
    renderSimple();

    expect(screen.getByTestId('plan-migration-panel')).toBeInTheDocument();
    expect(screen.getByText("We're updating our Business Plan")).toBeInTheDocument();
    expect(
      screen.getByText('10M spans for easier debugging and performance monitoring')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Simplified, cheaper pay-as-you-go pricing')
    ).toBeInTheDocument();
    expect(screen.getByText('And more...')).toBeInTheDocument();
    expect(screen.getByText(migrationDate, {exact: false})).toBeInTheDocument();
  });

  it('renders plan migration table', function () {
    renderSimple();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(8);
  });

  it('renders plan row', function () {
    renderSimple();
    expect(screen.getByTestId('current-plan')).toHaveTextContent(/Legacy Business/);
    expect(screen.getByTestId('new-plan')).toHaveTextContent(/Business/);
  });

  it('does not render contract row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-contract')).not.toBeInTheDocument();
  });

  it('renders price row', function () {
    renderSimple();
    expect(screen.getByTestId('current-price')).toHaveTextContent(/\$960/);
    expect(screen.getByTestId('new-price')).toHaveTextContent(/\$960/);
  });

  it('does not renders renewal price row', function () {
    renderSimple();
    expect(screen.queryByTestId('current-renewal')).not.toBeInTheDocument();
  });

  it('renders errors row', function () {
    renderSimple();
    expect(screen.getByTestId('current-errors')).toHaveTextContent(/50K errors/);
    expect(screen.getByTestId('new-errors')).toHaveTextContent(/50K errors/);
  });

  it('renders spans row', function () {
    renderSimple();
    expect(screen.getByTestId('current-spans')).toHaveTextContent(
      /100K performance units/
    );
    expect(screen.getByTestId('new-spans')).toHaveTextContent(/10M spans/);
  });

  it('renders attachments row', function () {
    renderSimple();
    expect(screen.getByTestId('current-attachments')).toHaveTextContent(/1 GB/);
    expect(screen.getByTestId('new-attachments')).toHaveTextContent(/1 GB/);
  });

  it('renders replays row', function () {
    renderSimple();
    expect(screen.getByTestId('current-replays')).toHaveTextContent(/500 replays/);
    expect(screen.getByTestId('new-replays')).toHaveTextContent(/50 replays/);
  });

  it('renders monitor seats row', function () {
    renderSimple();
    expect(screen.getByTestId('current-monitorSeats')).toHaveTextContent(
      /1 cron monitor/
    );
    expect(screen.getByTestId('new-monitorSeats')).toHaveTextContent(/1 cron monitor/);
  });

  it('renders replays credit message', function () {
    renderSimple();
    expect(screen.getByTestId('recurring-credits')).toHaveTextContent(
      /\*You'll retain the same monthly replay quota throughout the remainder of your annual subscription./
    );
  });
});
