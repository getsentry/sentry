import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {DataCategory, DataCategoryExact} from 'sentry/types/core';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';

import {ANNUAL, MONTHLY} from 'getsentry/constants';
import {
  CohortId,
  type NextPlanInfo,
  type PlanMigration,
  type Subscription,
} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {displayPrice} from 'getsentry/views/amCheckout/utils';

import {AlertStripedTable} from '../styles';

import PlanMigrationRow from './planMigrationRow';

type Props = {
  migration: PlanMigration;
  subscription: Subscription;
};

function PlanMigrationTable({subscription, migration}: Props) {
  if (!migration?.cohort?.nextPlan) {
    return null;
  }

  const isAM3Migration = migration.cohort.cohortId >= CohortId.EIGHTH;

  const planName = subscription.planDetails.name;
  const planPrice = subscription.planDetails.price;

  const planTerm = subscription.planDetails.contractInterval;
  const cohort = migration.cohort;
  const nextPlan = cohort.nextPlan!;
  const secondDiscount = cohort.secondDiscount;
  // Setting default to monthly to handle nextPlan if the endpoint update is not updated yet
  // Prior plan migrations are all monthly contracts
  const nextPlanTerm = nextPlan.contractPeriod ?? MONTHLY;
  const hasErrorCredits = !!(nextPlan.errorCredits && nextPlan.errorCreditsMonths);
  // The nextPlan.discountAmount is handled differently for monthly & annual billing intervals. Using these checks to display correct info
  const hasMonthlyDiscount = !!(
    nextPlan.discountAmount &&
    nextPlan.discountMonths &&
    subscription.billingInterval === MONTHLY
  );
  const hasAnnualDiscount = !!(
    nextPlan.discountAmount &&
    nextPlan.discountMonths &&
    subscription.billingInterval === ANNUAL
  );
  const hasSecondDiscount = !!(secondDiscount && hasAnnualDiscount);
  const annualMigrationDate = migration.effectiveAt
    ? moment(migration.effectiveAt).format('ll')
    : moment(subscription.onDemandPeriodEnd).add(1, 'days').format('ll');

  return (
    <TableContainer>
      <AlertStripedTable>
        <thead>
          <tr>
            <th />
            <th>{t('Current')}</th>
            <th />
            <th>{t('New')}</th>
          </tr>
        </thead>
        <tbody>
          <PlanMigrationRow
            type="plan"
            currentValue={planName}
            nextValue={nextPlan.name}
          />
          {planTerm !== nextPlanTerm && (
            <PlanMigrationRow
              type="contract"
              currentValue={planTerm}
              nextValue={nextPlanTerm}
            />
          )}
          <PlanMigrationRow
            type="price"
            currentValue={planPrice}
            discountPrice={planPrice}
            nextValue={isAM3Migration ? planPrice : nextPlan.totalPrice}
            hasCredits={hasMonthlyDiscount || hasAnnualDiscount}
          />
          {hasAnnualDiscount && (
            <PlanMigrationRow
              type="renewal"
              currentValue={planPrice}
              discountPrice={nextPlan.totalPrice - secondDiscount}
              nextValue={nextPlan.totalPrice}
              hasCredits={hasSecondDiscount}
            />
          )}
          <PlanMigrationRow
            type={DataCategoryExact.ERROR}
            currentValue={
              subscription.categories.errors?.reserved ?? subscription.reservedEvents
            }
            nextValue={getNextDataCategoryValue(
              nextPlan,
              isAM3Migration,
              DataCategoryExact.ERROR,
              subscription
            )}
            hasCredits={hasErrorCredits}
          />
          {isAM3Migration
            ? nextPlan.reserved.spans && (
                <PlanMigrationRow
                  type={DataCategoryExact.SPAN}
                  currentValue={subscription.categories.transactions?.reserved ?? null}
                  nextValue={getNextDataCategoryValue(
                    nextPlan,
                    isAM3Migration,
                    DataCategoryExact.SPAN,
                    subscription
                  )}
                />
              )
            : nextPlan.reserved.transactions && (
                <PlanMigrationRow
                  type={DataCategoryExact.TRANSACTION}
                  currentValue={subscription.categories.transactions?.reserved ?? null}
                  nextValue={getNextDataCategoryValue(
                    nextPlan,
                    isAM3Migration,
                    DataCategoryExact.TRANSACTION,
                    subscription
                  )}
                />
              )}
          <PlanMigrationRow
            type={DataCategoryExact.ATTACHMENT}
            currentValue={subscription.categories.attachments?.reserved ?? null}
            nextValue={getNextDataCategoryValue(
              nextPlan,
              isAM3Migration,
              DataCategoryExact.ATTACHMENT,
              subscription
            )}
          />
          {nextPlan.reserved.replays && (
            <PlanMigrationRow
              type={DataCategoryExact.REPLAY}
              currentValue={subscription.categories.replays?.reserved ?? null}
              nextValue={getNextDataCategoryValue(
                nextPlan,
                isAM3Migration,
                DataCategoryExact.REPLAY,
                subscription
              )}
            />
          )}
          {nextPlan.reserved.monitorSeats && (
            <PlanMigrationRow
              type={DataCategoryExact.MONITOR_SEAT}
              currentValue={subscription.categories.monitorSeats?.reserved ?? null}
              nextValue={getNextDataCategoryValue(
                nextPlan,
                isAM3Migration,
                DataCategoryExact.MONITOR_SEAT,
                subscription
              )}
            />
          )}
          {isAM3Migration && nextPlan.reserved.profileDuration && (
            <PlanMigrationRow
              type={DataCategoryExact.PROFILE_DURATION}
              currentValue={subscription.categories.profileDuration?.reserved ?? null}
              nextValue={getNextDataCategoryValue(
                nextPlan,
                isAM3Migration,
                DataCategoryExact.PROFILE_DURATION,
                subscription
              )}
            />
          )}
        </tbody>
      </AlertStripedTable>
      {hasErrorCredits && (
        <Credits data-test-id="error-credits">
          *
          {tct(
            'We will provide an extra [errorCredits] errors for [errorCreditsMonths] months at no additional charge.',
            {
              errorCredits: formatReservedWithUnits(
                nextPlan.errorCredits || 0,
                DataCategory.ERRORS,
                {
                  isAbbreviated: true,
                }
              ),
              errorCreditsMonths: nextPlan.errorCreditsMonths,
            }
          )}
        </Credits>
      )}
      {hasMonthlyDiscount && (
        <Credits data-test-id="dollar-credits">
          *
          {tct(
            '[currentPrice] for [discountMonths] months, then changes to [nextPrice] per month on [discountEndDate].',
            {
              currentPrice: displayPrice({cents: subscription.planDetails.price}),
              discountMonths: nextPlan.discountMonths,
              nextPrice: displayPrice({cents: nextPlan.totalPrice}),
              discountEndDate: moment(subscription.contractPeriodEnd)
                .add(nextPlan.discountMonths, 'months')
                .add(1, 'days')
                .format('ll'),
            }
          )}
        </Credits>
      )}
      {hasAnnualDiscount && (
        <Credits data-test-id="annual-dollar-credits">
          *
          {tct('Discount of [firstDiscount] for plan changes on [migrationDate].', {
            migrationDate: annualMigrationDate,
            firstDiscount: displayPrice({
              cents: nextPlan.totalPrice - subscription.planDetails.price,
            }),
          })}
          {hasSecondDiscount &&
            tct(
              ' An additional one-time [secondDiscount] discount applies at contract renewal on [contractRenewalDate].',
              {
                secondDiscount: displayPrice({cents: secondDiscount}),
                contractRenewalDate: moment(subscription.contractPeriodEnd)
                  .add(1, 'days')
                  .format('ll'),
              }
            )}
        </Credits>
      )}
      {isAM3Migration && getAM3MigrationCredits(migration.cohort.cohortId, nextPlan)}
    </TableContainer>
  );
}

function getNextDataCategoryValue(
  nextPlan: NextPlanInfo,
  isAM3Migration: boolean,
  category: DataCategoryExact,
  subscription: Subscription
) {
  const key = DATA_CATEGORY_INFO[category].plural;
  if (
    isAM3Migration &&
    subscription.planDetails.categories.includes(key) &&
    subscription.categories[key]?.reserved !==
      subscription.planDetails.planCategories[key]![0]!.events
  ) {
    return subscription.categories[key]!.reserved;
  }
  return nextPlan.reserved[key] ?? null;
}

function getAM3MigrationCredits(cohortId: CohortId, nextPlan: NextPlanInfo) {
  let message: string;
  if (cohortId === CohortId.TENTH) {
    message =
      "You'll retain the same monthly replay quota throughout the remainder of your annual subscription.";
  } else if (!nextPlan.categoryCredits) {
    return null;
  } else {
    const categoryCredits = nextPlan.categoryCredits;

    message = "We'll provide an additional ";
    const isAnnualNextPlan = nextPlan.contractPeriod === 'annual';

    const creditsToDisplay: string[] = [];

    Object.keys(categoryCredits)
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      .filter(category => categoryCredits[category] !== null)
      .forEach(category => {
        if (
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          categoryCredits[category].credits !== 0 &&
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          categoryCredits[category].months !== 0
        ) {
          creditsToDisplay.push(
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            `${categoryCredits[category].credits} ${category} for the next ${categoryCredits[category].months} ${isAnnualNextPlan ? 'months' : 'monthly usage cycles'}`
          );
        }
      });

    message += oxfordizeArray(creditsToDisplay);

    if (nextPlan.contractPeriod === 'annual') {
      message += ' following the end of your current annual contract';
    } else {
      message += ' after your plan is upgraded';
    }
    message += ', at no charge.';
  }

  return (
    <Credits data-test-id="recurring-credits">*{tct('[message]', {message})}</Credits>
  );
}

const TableContainer = styled('div')`
  display: grid;
  grid-auto-flow: row;
  align-content: space-between;
`;

const Credits = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

export default PlanMigrationTable;
