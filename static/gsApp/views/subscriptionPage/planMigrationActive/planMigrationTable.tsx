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
import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';
import {displayPrice} from 'getsentry/views/amCheckout/utils';
import {AlertStripedTable} from 'getsentry/views/subscriptionPage/styles';

import PlanMigrationRow from './planMigrationRow';

type Props = {
  migration: PlanMigration;
  subscription: Subscription;
};

function PlanMigrationTable({subscription, migration}: Props) {
  if (!migration?.cohort?.nextPlan) {
    return null;
  }

  // migrations from AM1/AM2 to AM3
  const isAM3Migration =
    migration.cohort.cohortId >= CohortId.EIGHTH &&
    migration.cohort.cohortId <= CohortId.TENTH;

  const planName = subscription.planDetails.name;
  const planPrice = subscription.planDetails.price;

  const planTerm = subscription.planDetails.contractInterval;
  const cohort = migration.cohort;
  const nextPlan = cohort.nextPlan!;
  const secondDiscount = cohort.secondDiscount;
  // Setting default to monthly to handle nextPlan if the endpoint update is not updated yet
  // Prior plan migrations are all monthly contracts
  const nextPlanTerm = nextPlan.contractPeriod ?? MONTHLY;
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

  const getRowParamsForCategory = (category: DataCategory) => {
    // for AM1/AM2 to AM3 migrations, we move from transactions-based billing to spans-based billing
    // so we render the row as a transition from reserved transactions volume to reserved spans volume
    const isSpans = category === DataCategory.SPANS;
    const shouldShowCurrentSpans =
      isSpans && !!subscription.categories[category]?.reserved;
    const isTransactionsToSpansMigration = isSpans && !shouldShowCurrentSpans;

    const currentValue = isTransactionsToSpansMigration
      ? (subscription.categories.transactions?.reserved ?? null)
      : (subscription.categories[category]?.reserved ?? null);
    const titleOverride = isTransactionsToSpansMigration
      ? t('Tracing and Performance Monitoring')
      : undefined;
    const previousType = isTransactionsToSpansMigration
      ? DataCategoryExact.TRANSACTION
      : undefined;

    const categoryInfo = getCategoryInfoFromPlural(category);
    if (!categoryInfo) {
      return null;
    }

    const type = categoryInfo.name;

    const nextValue = getNextDataCategoryValue(
      nextPlan,
      isAM3Migration, // update this if shouldUseExistingVolume should be true for future migrations
      type,
      subscription
    );

    return {
      type,
      previousType,
      currentValue,
      nextValue,
      hasCredits: !!nextPlan.categoryCredits?.[category]?.credits,
      titleOverride,
    };
  };

  const sortRowParamMappings = (
    rowParamsMapping: Array<ReturnType<typeof getRowParamsForCategory>>
  ) => {
    return rowParamsMapping
      .filter(rowParams => !!rowParams)
      .sort((a, b) => {
        // sort based on order of the categories in the subscription's current plan
        // if previousType exists, we need to use that since it means we're migrating
        // from a category on the subscription's current plan that won't be available
        // in the new plan
        const aCategoryExact = a?.previousType ?? a?.type;
        const bCategoryExact = b?.previousType ?? b?.type;
        const aCategory = aCategoryExact
          ? DATA_CATEGORY_INFO[aCategoryExact]?.plural
          : null;
        const bCategory = bCategoryExact
          ? DATA_CATEGORY_INFO[bCategoryExact]?.plural
          : null;
        const aOrder = aCategory
          ? (subscription.categories[aCategory]?.order ?? Infinity)
          : Infinity;
        const bOrder = bCategory
          ? (subscription.categories[bCategory]?.order ?? Infinity)
          : Infinity;
        return aOrder - bOrder;
      });
  };

  const getCategoryRows = () => {
    const rowParamsMapping = Object.entries(nextPlan.reserved)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([category, _]) => getRowParamsForCategory(category as DataCategory));

    return sortRowParamMappings(rowParamsMapping).map(rowParams => (
      <PlanMigrationRow key={rowParams.type} {...rowParams} />
    ));
  };

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
          {getCategoryRows()}
        </tbody>
      </AlertStripedTable>
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
      {getCategoryCredits(migration.cohort.cohortId, nextPlan)}
    </TableContainer>
  );
}

function getNextDataCategoryValue(
  nextPlan: NextPlanInfo,
  shouldUseExistingVolume: boolean,
  category: DataCategoryExact,
  subscription: Subscription
) {
  const key = DATA_CATEGORY_INFO[category].plural as DataCategory;
  if (
    shouldUseExistingVolume &&
    subscription.planDetails.categories.includes(key) &&
    subscription.categories[key]?.reserved !==
      subscription.planDetails.planCategories[key]![0]!.events
  ) {
    return subscription.categories[key]!.reserved;
  }
  return nextPlan.reserved[key] ?? null;
}

function getCategoryCredits(cohortId: CohortId, nextPlan: NextPlanInfo) {
  if (!nextPlan.categoryCredits) {
    return null;
  }

  let message: string;
  if (cohortId === CohortId.TENTH) {
    message =
      "You'll retain the same monthly replay quota throughout the remainder of your annual subscription.";
  } else {
    const categoryCredits = nextPlan.categoryCredits;

    message = "We'll provide an additional ";
    const isAnnualNextPlan = nextPlan.contractPeriod === 'annual';

    const creditsToDisplay: string[] = [];

    Object.entries(categoryCredits)
      .filter(([_, creditInfo]) => creditInfo.credits !== null)
      .forEach(([category, creditInfo]) => {
        const {credits, months} = creditInfo;
        if (credits !== 0 && months !== 0) {
          creditsToDisplay.push(
            `${credits} ${category} for the next ${months} ${isAnnualNextPlan ? 'months' : 'monthly usage cycles'}`
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
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

export default PlanMigrationTable;
