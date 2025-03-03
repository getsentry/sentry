import styled from '@emotion/styled';
import moment from 'moment-timezone';

import Panel from 'sentry/components/panels/panel';
import {IconFire, IconStats, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import withOrganization from 'sentry/utils/withOrganization';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import AddEventsCTA from 'getsentry/components/addEventsCTA';
import {GIGABYTE, RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import OrgStatsBanner from 'getsentry/hooks/orgStatsBanner';
import type {CustomerUsage, Subscription} from 'getsentry/types';
import {
  formatReservedWithUnits,
  formatUsageWithUnits,
  getBestActionToIncreaseEventLimits,
  hasPerformance,
  isBizPlanFamily,
  isUnlimitedReserved,
  UsageAction,
} from 'getsentry/utils/billing';
import {getPlanCategoryName, sortCategoriesWithKeys} from 'getsentry/utils/dataCategory';

import {ButtonWrapper, SubscriptionBody} from './styles';

type ProjectedOverages = string[];

type Props = {
  organization: Organization;
  subscription: Subscription;
  usage: CustomerUsage;
};

function UsageAlert({organization, subscription, usage}: Props) {
  function getActionSentence() {
    switch (getBestActionToIncreaseEventLimits(organization, subscription)) {
      case UsageAction.START_TRIAL:
        return t('Start a free trial to avoid data loss.');
      case UsageAction.ADD_EVENTS:
        return t('Increase your event limits to avoid data loss.');
      case UsageAction.REQUEST_ADD_EVENTS:
        return t(
          'Bug your organization owner to increase your event limits to avoid data loss.'
        );
      case UsageAction.REQUEST_UPGRADE:
        return t('Bug your organization owner to upgrade your plan to avoid data loss.');
      case UsageAction.SEND_TO_CHECKOUT:
      default:
        return t('Upgrade your plan to avoid data loss.');
    }
  }

  function formatProjected(projected: number, category: string): string {
    const displayName = getPlanCategoryName({
      plan: subscription.planDetails,
      category,
      capitalize: false,
      hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
    });

    return category === DataCategory.ATTACHMENTS
      ? `${formatUsageWithUnits(projected, category)} of attachments`
      : `${formatReservedWithUnits(projected, category, {
          isAbbreviated: true,
        })} ${displayName}`;
  }

  function projectedCategoryOverages() {
    // hide projected overages for plans with on-demand for now since
    // shared on-demand budget can be applied to any data category
    if (subscription.onDemandMaxSpend) {
      return [];
    }

    return Object.entries(subscription.categories).reduce<ProjectedOverages>(
      (acc, [category, currentHistory]) => {
        if (
          currentHistory.reserved === RESERVED_BUDGET_QUOTA ||
          isUnlimitedReserved(currentHistory.reserved)
        ) {
          return acc;
        }
        const projected = usage.totals[category]?.projected || 0;
        const projectedWithReservedUnit =
          category === DataCategory.ATTACHMENTS ? projected / GIGABYTE : projected;

        const hasOverage =
          !!currentHistory.reserved &&
          projectedWithReservedUnit > (currentHistory.prepaid ?? 0);

        if (hasOverage) {
          acc.push(formatProjected(projected, category));
        }
        return acc;
      },
      []
    );
  }

  function getProjectedOverages(): ProjectedOverages {
    if (subscription.isEnterpriseTrial || subscription.hasOverageNotificationsDisabled) {
      return [];
    }
    return projectedCategoryOverages();
  }

  function renderProjectedInfo(projectedOverages: ProjectedOverages) {
    if (!projectedOverages) {
      return null;
    }

    return (
      <Panel data-test-id="projected-overage-alert">
        <SubscriptionBody withPadding>
          <UsageInfo>
            <IconStats size="md" color="blue300" />
            <div>
              <h3>{t('Projected Overage')}</h3>
              <Description>
                {tct(
                  `Based on your previous usage, we predict your organization will need at least [totals].`,
                  {totals: oxfordizeArray(projectedOverages)}
                )}{' '}
                {getActionSentence()}
              </Description>
            </div>
          </UsageInfo>
          {renderPrimaryCTA('projected-overage')}
        </SubscriptionBody>
      </Panel>
    );
  }

  function renderGracePeriodInfo() {
    return (
      <Panel data-test-id="grace-period-alert">
        <SubscriptionBody withPadding>
          <UsageInfo>
            <IconWarning size="md" color="yellow300" />
            <div>
              <h3>{t('Grace Period')}</h3>
              <Description>
                {tct(
                  `Your organization has depleted its error capacity for the current usage period.
                  We've put your account into a one time grace period, which will continue to accept errors at a limited rate.
                  This grace period ends on [gracePeriodEnd].`,
                  {gracePeriodEnd: moment(subscription.gracePeriodEnd).format('ll')}
                )}{' '}
                {getActionSentence()}
              </Description>
            </div>
          </UsageInfo>
          {renderPrimaryCTA('grace-period')}
        </SubscriptionBody>
      </Panel>
    );
  }

  function renderExceededInfo() {
    const exceededList = sortCategoriesWithKeys(subscription.categories).reduce(
      (acc, [category, currentHistory]) => {
        if (currentHistory.usageExceeded) {
          acc.push(
            getPlanCategoryName({
              plan: subscription.planDetails,
              category,
              capitalize: false,
              hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
            })
          );
        }
        return acc;
      },
      [] as string[]
    );

    const quotasExceeded =
      exceededList.length > 0
        ? oxfordizeArray(exceededList)
        : getPlanCategoryName({
            plan: subscription.planDetails,
            category: DataCategory.ERRORS,
            capitalize: false,
            hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
          });

    return (
      <Panel data-test-id="usage-exceeded-alert">
        <SubscriptionBody withPadding>
          <UsageInfo>
            <IconFire size="md" color="red300" />
            <div>
              <h3>{t('Usage Exceeded')}</h3>
              <Description>
                {tct(
                  `Your organization has depleted its [quotasExceeded] capacity for the current usage period.`,
                  {quotasExceeded}
                )}{' '}
                {getActionSentence()}
              </Description>
            </div>
          </UsageInfo>
          {renderPrimaryCTA('exceded-quota')}
        </SubscriptionBody>
      </Panel>
    );
  }

  function renderDefaultEventCTA() {
    // allow business plan members to request events even if no overages
    // every other user will have another type of CTA
    if (
      getBestActionToIncreaseEventLimits(organization, subscription) ===
        'request_add_events' &&
      isBizPlanFamily(subscription.planDetails) &&
      hasPerformance(subscription.planDetails)
    ) {
      return (
        <OrgStatsBanner
          organization={organization}
          referrer="subscription-default-event-cta"
        />
      );
    }
    return null;
  }

  function renderPrimaryCTA(alertType: string) {
    if (!subscription.canSelfServe) {
      return null;
    }

    return (
      <ButtonWrapper>
        <AddEventsCTA
          {...{
            organization,
            subscription,
            source: `subscription-usage-alert-${alertType}`,
            referrer: `subscription-usage-alert-${alertType}`,
            buttonProps: {
              size: 'sm',
            },
          }}
        />
      </ButtonWrapper>
    );
  }

  if (!subscription || !usage) {
    return null;
  }

  const hasExceeded =
    Object.values(subscription.categories).some(({usageExceeded}) => usageExceeded) ||
    // TODO: Remove when mmx plans have error BillingMetricHistory
    subscription.usageExceeded;
  const projectedOverages = getProjectedOverages();
  const hasOverage =
    subscription.isGracePeriod || hasExceeded || !!projectedOverages.length;

  // if no overage, we can still have a CTA
  if (!hasOverage) {
    return renderDefaultEventCTA();
  }

  const showProjected = !hasExceeded && !subscription.isGracePeriod;

  return (
    <div data-test-id="usage-alert">
      {hasExceeded && renderExceededInfo()}
      {subscription.isGracePeriod && renderGracePeriodInfo()}
      {showProjected && renderProjectedInfo(projectedOverages)}
    </div>
  );
}

export default withOrganization(UsageAlert);

const UsageInfo = styled('div')`
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${space(1)};
`;

const Description = styled(TextBlock)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  margin-bottom: 0;
`;
