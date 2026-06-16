import {useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Heading, Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getDaysSinceDate} from 'sentry/utils/getDaysSinceDate';
import {getProfileDurationCategoryForPlatform} from 'sentry/utils/profiling/platforms';
import {useOrganization} from 'sentry/utils/useOrganization';

import AddEventsCTA, {type EventType} from 'getsentry/components/addEventsCTA';
import {StartTrialButton} from 'getsentry/components/startTrialButton';
import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import type {BilledDataCategoryInfo, ProductTrial, Subscription} from 'getsentry/types';
import {displayBudgetName, getProductTrial, UsageAction} from 'getsentry/utils/billing';
import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';
import {BudgetUsage, checkBudgetUsageFor} from 'getsentry/utils/profiling';

export function makeLinkToOwnersAndBillingMembers(
  organization: Organization,
  referrer: string
) {
  return `/settings/${organization.slug}/members/?referrer=${referrer}&query=role%3Abilling+role%3Aowner`;
}

export function makeLinkToManageSubscription(
  organization: Organization,
  referrer: string
) {
  return `/settings/${organization.slug}/billing/overview/?referrer=${referrer}`;
}

interface ContinuousProfilingBillingRequirementBanner {
  project: Project;
}

export function ContinuousProfilingBillingRequirementBanner({
  project,
}: ContinuousProfilingBillingRequirementBanner) {
  const organization = useOrganization();
  const subscription = useSubscription();

  if (!subscription) {
    return null;
  }

  // only check quota for plans with continuous profiling
  if (!subscription.planDetails?.categories?.includes(DataCategory.PROFILE_DURATION)) {
    return null;
  }

  const dataCategory = getProfileDurationCategoryForPlatform(project.platform);

  // We don't know the correct category for the platform,
  // likely doesn't support profiling.
  if (!dataCategory) {
    return null;
  }

  const categoryInfo = getCategoryInfoFromPlural(dataCategory);
  if (!categoryInfo) {
    return null;
  }

  // There's budget allocated so profiling can be used.
  const budgetUsage = checkBudgetUsageFor(subscription, dataCategory);

  if (budgetUsage === BudgetUsage.EXCEEDED) {
    // budget configured but has been consumed
    return null;
  }

  // only true when there is no configured budget
  if (budgetUsage !== BudgetUsage.UNAVAILABLE) {
    return null;
  }

  if (subscription.canTrial) {
    return (
      <BusinessTrialBanner
        dataCategory={dataCategory}
        categoryInfo={categoryInfo}
        subscription={subscription}
        organization={organization}
      />
    );
  }

  const trial = getProductTrial(subscription.productTrials ?? null, dataCategory);

  if (trial) {
    const daysLeft = -1 * getDaysSinceDate(trial.endDate ?? '');
    if (daysLeft >= 0) {
      if (trial.isStarted) {
        return null;
      }
      return (
        <ProductTrialBanner
          trial={trial}
          dataCategory={dataCategory}
          categoryInfo={categoryInfo}
          subscription={subscription}
          organization={organization}
        />
      );
    }
  }

  return (
    <OnDemandOrPaygBanner
      dataCategory={dataCategory}
      categoryInfo={categoryInfo}
      subscription={subscription}
      organization={organization}
    />
  );
}

interface ProductBannerProps {
  categoryInfo: BilledDataCategoryInfo;
  dataCategory: DataCategory.PROFILE_DURATION | DataCategory.PROFILE_DURATION_UI;
  organization: Organization;
  subscription: Subscription;
}

function BusinessTrialBanner({
  organization,
  categoryInfo,
  subscription,
}: ProductBannerProps) {
  return (
    <Alert variant="info">
      <Heading as="h3">{t('Try Sentry Business for Free')}</Heading>
      <AlertBody>
        <Text>
          {tct(
            'Want to give [product] a test drive without paying? Start a Business plan trial, free for 14 days.',
            {product: categoryInfo.productName}
          )}
        </Text>
      </AlertBody>
      <div>
        <UpgradeOrTrialButton
          source="profiling_onboarding"
          action="trial"
          subscription={subscription}
          organization={organization}
        />
      </div>
    </Alert>
  );
}

interface ProductTrialBannerProps extends ProductBannerProps {
  trial: ProductTrial;
}

function ProductTrialBanner({
  organization,
  categoryInfo,
  trial,
}: ProductTrialBannerProps) {
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  return (
    <Alert variant="info">
      <Heading as="h3">
        {tct('Try [product] for free', {product: categoryInfo.productName})}
      </Heading>
      <AlertBody>
        <Text>
          {tct(
            'Activate your trial to take advantage of 14 days of unlimited [product]',
            {
              product: categoryInfo.productName,
            }
          )}
        </Text>
      </AlertBody>
      <div>
        <StartTrialButton
          size="sm"
          organization={organization}
          source="profiling_onboarding"
          requestData={{
            productTrial: {
              category: trial.category,
              reasonCode: trial.reasonCode,
            },
          }}
          aria-label={t('Start trial')}
          variant="primary"
          handleClick={() => setIsStartingTrial(true)}
          onTrialStarted={() => setIsStartingTrial(true)}
          onTrialFailed={() => setIsStartingTrial(false)}
          busy={isStartingTrial}
          disabled={isStartingTrial}
        />
      </div>
    </Alert>
  );
}

function OnDemandOrPaygBanner({
  dataCategory,
  organization,
  categoryInfo,
  subscription,
}: ProductBannerProps) {
  const eventTypes: EventType[] = [
    getCategoryInfoFromPlural(dataCategory)?.name as EventType,
  ];
  const hasBillingPerms = organization.access?.includes('org:billing');

  return (
    <Alert variant="info">
      <Heading as="h3">
        {displayBudgetName(subscription.planDetails, {title: true})}
      </Heading>
      <AlertBody>
        <Text>
          {tct(
            '[product] is charged on a [budgetTerm] basis. Please ensure you have set up a budget.',
            {
              product: categoryInfo.productName,
              budgetTerm: subscription.planDetails.budgetTerm,
            }
          )}
        </Text>
      </AlertBody>
      <div>
        <AddEventsCTA
          organization={organization}
          subscription={subscription}
          buttonProps={{
            variant: 'primary',
            size: 'sm',
            style: {textDecoration: 'none'},
          }}
          eventTypes={eventTypes}
          action={
            hasBillingPerms ? UsageAction.ADD_EVENTS : UsageAction.REQUEST_ADD_EVENTS
          }
          referrer="profiling-onboarding"
          source="profiling_onboarding"
        />
      </div>
    </Alert>
  );
}

const AlertBody = styled('div')`
  margin-bottom: ${p => p.theme.space.md};
`;
