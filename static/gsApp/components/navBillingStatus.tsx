import {Fragment, useCallback, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import snakeCase from 'lodash/snakeCase';
import moment from 'moment-timezone';

import type {PromptData} from 'sentry/actionCreators/prompts';
import {usePrompts} from 'sentry/actionCreators/prompts';
import {Button, type ButtonProps} from 'sentry/components/core/button';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {SidebarButton} from 'sentry/views/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/views/nav/primary/primaryButtonOverlay';

import AddEventsCTA, {type EventType} from 'getsentry/components/addEventsCTA';
import useSubscription from 'getsentry/hooks/useSubscription';
import {
  OnDemandBudgetMode,
  type BillingMetricHistory,
  type Subscription,
} from 'getsentry/types';
import {
  getCategoryInfoFromPlural,
  getSingularCategoryName,
  listDisplayNames,
  sortCategoriesWithKeys,
} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

const COMMON_BUTTON_PROPS: Partial<ButtonProps> = {
  size: 'xs',
};

function QuotaExceededContent({
  exceededCategories,
  subscription,
  organization,
  onClick,
  isDismissed,
}: {
  exceededCategories: DataCategory[];
  isDismissed: boolean;
  onClick: ({
    eventTypes,
    isManual,
  }: {
    eventTypes: EventType[];
    isManual?: boolean;
  }) => void;
  organization: Organization;
  subscription: Subscription;
}) {
  const seatCategories: DataCategory[] = [];
  const usageCategories: DataCategory[] = [];
  const eventTypes: EventType[] = exceededCategories.map(category => {
    const categoryInfo = getCategoryInfoFromPlural(category);
    if (categoryInfo?.tallyType === 'seat') {
      seatCategories.push(category);
    } else {
      usageCategories.push(category);
    }
    return (categoryInfo?.name ?? category) as EventType;
  });

  const usageCategoryList = listDisplayNames({
    plan: subscription.planDetails,
    categories: usageCategories,
    hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
  });
  const seatCategoryList = listDisplayNames({
    plan: subscription.planDetails,
    categories: seatCategories,
    hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
  });

  return (
    <Container>
      <Header>
        <HeaderTitle>{t('Billing Status')}</HeaderTitle>
      </Header>
      <Body>
        <Title>
          {exceededCategories.length === 1
            ? tct('[category] Quota Exceeded', {
                category: getSingularCategoryName({
                  plan: subscription.planDetails,
                  category: exceededCategories[0]!,
                  hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
                  title: true,
                }),
              })
            : t('Quotas Exceeded')}
        </Title>
        {usageCategories.length > 0 && (
          <Description>
            {tct(
              'You have used up your quota for [usageCategoryList]. Monitoring and new data [descriptor]are paused until your quota resets.',
              {
                usageCategoryList,
                descriptor: usageCategories.length > 1 ? t('for these features ') : '',
              }
            )}
          </Description>
        )}
        {seatCategories.length > 0 && (
          <Description>
            {tct(
              '[prefix] reached your quota for [seatCategoryList]. Existing monitors remain active, but you cannot add new ones until your quota resets.',
              {
                prefix: usageCategories.length > 0 ? t('You have also') : t('You have'),
                seatCategoryList,
              }
            )}
          </Description>
        )}
        <ActionContainer>
          <AddEventsCTA
            organization={organization}
            subscription={subscription}
            buttonProps={COMMON_BUTTON_PROPS}
            eventTypes={eventTypes}
            notificationType="overage_critical"
            referrer={`overage-alert-${eventTypes.join('-')}`}
            source="nav-quota-overage"
            handleRequestSent={() => onClick({eventTypes})}
          />
          {!isDismissed && (
            <Button
              aria-label={t('Dismiss alert for the rest of the billing cycle')}
              onClick={() =>
                onClick({
                  eventTypes,
                  isManual: true,
                })
              }
              {...COMMON_BUTTON_PROPS}
            >
              {t('Dismiss')}
            </Button>
          )}
        </ActionContainer>
      </Body>
    </Container>
  );
}

function PrimaryNavigationQuotaExceeded({organization}: {organization: Organization}) {
  const subscription = useSubscription();
  const exceededCategories = (
    sortCategoriesWithKeys(subscription?.categories ?? {}) as Array<
      [DataCategory, BillingMetricHistory]
    >
  )
    .filter(
      ([category]) =>
        category !== DataCategory.SPANS_INDEXED || subscription?.hadCustomDynamicSampling
    )
    .reduce((acc, [category, currentHistory]) => {
      if (currentHistory.usageExceeded) {
        const designatedBudget =
          subscription?.onDemandBudgets?.budgetMode === OnDemandBudgetMode.PER_CATEGORY
            ? subscription.onDemandBudgets.budgets[category]
            : subscription?.onDemandMaxSpend;

        const reservedTiers = subscription?.planDetails.planCategories?.[category];
        if (
          !designatedBudget &&
          reservedTiers?.length === 1 &&
          reservedTiers[0]?.events === 1
        ) {
          // if there isn't any PAYG and the category has a single reserved tier which is 1 (ie. crons, uptime, etc),
          // then we don't need to show the alert
          return acc;
        }
        acc.push(category);
      }
      return acc;
    }, [] as DataCategory[]);
  const promptsToCheck = exceededCategories
    .map(category => {
      return `${snakeCase(category)}_overage_alert`;
    })
    .filter(Boolean);

  /**
   * Check if the prompt is snoozed for the current on-demand period.
   * Valid snoozed prompts are those that were snoozed on or after the start of the current on-demand period
   * and before the start of the next on-demand period.
   */
  const isSnoozedForCurrentPeriod = (prompt: PromptData) => {
    const snoozedTime = prompt?.snoozedTime ?? prompt?.dismissedTime;
    if (typeof snoozedTime !== 'number') {
      return false;
    }
    const onDemandPeriodStart = moment(subscription?.onDemandPeriodStart).utc();
    const nextPeriodStart = moment(subscription?.onDemandPeriodEnd).utc().add(1, 'day');
    const snoozedOn = moment.unix(snoozedTime).utc();
    return (
      snoozedOn.isSameOrAfter(onDemandPeriodStart) && snoozedOn.isBefore(nextPeriodStart)
    );
  };

  const {isLoading, isError, isPromptDismissed, snoozePrompt} = usePrompts({
    features: promptsToCheck,
    organization,
    daysToSnooze:
      -1 *
      getDaysSinceDate(subscription?.onDemandPeriodEnd ?? moment().utc().toISOString()),
    isDismissed: isSnoozedForCurrentPeriod,
    options: {
      enabled: promptsToCheck.length > 0,
    },
  });

  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
    state: overlayState,
  } = usePrimaryButtonOverlay({});

  const hasSnoozedAllPrompts = useCallback(() => {
    return Object.values(isPromptDismissed).every(Boolean);
  }, [isPromptDismissed]);

  const hasAutoOpenedAlertRef = useRef(false);
  useEffect(() => {
    // auto open the alert if it hasn't been explicitly dismissed, and
    // either it has been more than a day since the last shown date,
    // the categories have changed, or
    // the last time it was shown was before the current usage cycle started
    const lastShownCategories = localStorage.getItem(
      `billing-status-last-shown-categories-${organization.id}`
    );
    const lastShownDate = localStorage.getItem(
      `billing-status-last-shown-date-${organization.id}`
    );
    const daysSinceLastShown = lastShownDate ? getDaysSinceDate(lastShownDate) : 0;
    const currentCategories = exceededCategories.join('-');
    const lastShownBeforeCurrentPeriod = moment(subscription?.onDemandPeriodStart)
      .utc()
      .isAfter(moment(lastShownDate).utc());
    if (
      !hasAutoOpenedAlertRef.current &&
      !hasSnoozedAllPrompts() &&
      (daysSinceLastShown >= 1 ||
        currentCategories !== lastShownCategories ||
        lastShownBeforeCurrentPeriod)
    ) {
      hasAutoOpenedAlertRef.current = true;
      overlayState.open();
      localStorage.setItem(
        `billing-status-last-shown-categories-${organization.id}`,
        currentCategories
      );
      localStorage.setItem(
        `billing-status-last-shown-date-${organization.id}`,
        moment().utc().toISOString()
      );
    }
  }, [
    exceededCategories,
    organization.id,
    hasSnoozedAllPrompts,
    overlayState,
    subscription?.onDemandPeriodStart,
  ]);

  const shouldShow =
    exceededCategories.length > 0 &&
    subscription &&
    subscription.canSelfServe &&
    !subscription.hasOverageNotificationsDisabled;
  if (!shouldShow || isLoading || isError) {
    return null;
  }

  const onDismiss = ({
    eventTypes,
    isManual = false,
  }: {
    eventTypes: EventType[];
    isManual?: boolean;
  }) => {
    promptsToCheck.forEach(prompt => {
      snoozePrompt(prompt);
    });
    if (isManual) {
      const analyticsEvent = 'quota_alert.clicked_snooze';
      trackGetsentryAnalytics(analyticsEvent, {
        organization,
        subscription,
        event_types: eventTypes?.sort().join(','),
        is_warning: false,
        source: 'nav-quota-overage',
      });
    }
    overlayState.close();
  };

  return (
    <Fragment>
      <SidebarButton
        analyticsKey="billingStatus"
        label={t('Billing Status')}
        buttonProps={{
          ...overlayTriggerProps,
        }}
      >
        <IconWarning />
      </SidebarButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <QuotaExceededContent
            exceededCategories={exceededCategories}
            subscription={subscription}
            organization={organization}
            isDismissed={hasSnoozedAllPrompts()}
            onClick={onDismiss}
          />
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}

export default PrimaryNavigationQuotaExceeded;

const Container = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
`;

const Header = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const HeaderTitle = styled('h1')`
  font-size: ${p => p.theme.fontSize.xl};
  margin-bottom: 0;
`;

const Title = styled('h2')`
  font-size: ${p => p.theme.fontSize.lg};
  margin-bottom: 0;
`;

const Body = styled('div')`
  margin: ${p => p.theme.space.xl};
  font-size: ${p => p.theme.fontSize.md};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

const Description = styled('div')`
  text-wrap: pretty;
`;
const ActionContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;
