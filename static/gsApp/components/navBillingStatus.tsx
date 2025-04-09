import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion, type MotionProps} from 'framer-motion';

import {usePrompts} from 'sentry/actionCreators/prompts';
import {Checkbox} from 'sentry/components/core/checkbox';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import type {Color} from 'sentry/utils/theme';
import {usePrefersStackedNav} from 'sentry/views/nav/prefersStackedNav';
import {SidebarButton} from 'sentry/views/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/views/nav/primary/primaryButtonOverlay';

import AddEventsCTA, {type EventType} from 'getsentry/components/addEventsCTA';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {getCategoryInfoFromPlural} from 'getsentry/utils/billing';
import {listDisplayNames, sortCategoriesWithKeys} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

const ANIMATE_PROPS: MotionProps = {
  animate: {
    rotate: [0, -15, 15, -15, 15, -15, 0],
    scale: [1, 1.25, 1.25, 1.25, 1.25, 1.25, 1],
  },
  transition: {
    duration: 0.7,
    repeat: Infinity,
    repeatType: 'loop',
    type: 'easeOut',
    delay: 2,
    repeatDelay: 1,
  },
};

function QuotaExceededContent({
  exceededCategories,
  subscription,
  organization,
  onCheck,
  isDismissed,
}: {
  exceededCategories: string[];
  isDismissed: boolean;
  onCheck: ({
    checked,
    eventTypes,
    isManual,
  }: {
    checked: boolean;
    eventTypes: EventType[];
    isManual?: boolean;
  }) => void;
  organization: Organization;
  subscription: Subscription;
}) {
  const eventTypes: EventType[] = exceededCategories.map(category => {
    const categoryInfo = getCategoryInfoFromPlural(category as DataCategory);
    return (categoryInfo?.name ?? category) as EventType;
  });
  return (
    <Container>
      <Header>
        <HeaderTitle>{t('Billing Status')}</HeaderTitle>
      </Header>
      <Body>
        <Title>{t('Quota Exceeded')}</Title>
        <Description>
          {tct(
            'You’ve run out of [exceededCategories] for this billing cycle. This means we are no longer monitoring or ingesting events and showing them in Sentry.',
            {
              exceededCategories: listDisplayNames({
                plan: subscription.planDetails,
                categories: exceededCategories,
                hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
              }),
            }
          )}
        </Description>
        <ActionContainer>
          <AddEventsCTA
            organization={organization}
            subscription={subscription}
            buttonProps={{
              size: 'xs',
            }}
            eventTypes={eventTypes}
            notificationType="overage_critical"
            referrer={`overage-alert-${eventTypes.join('-')}`}
            source="nav-quota-overage"
            handleRequestSent={() => onCheck({checked: true, eventTypes})}
          />
          <DismissContainer>
            <Checkbox
              name="dismiss"
              checked={isDismissed}
              onChange={e => {
                onCheck({checked: e.target.checked, eventTypes, isManual: true});
              }}
            />
            <CheckboxLabel>{t("Don't annoy me again")}</CheckboxLabel>
          </DismissContainer>
        </ActionContainer>
      </Body>
    </Container>
  );
}

function PrimaryNavigationQuotaExceeded({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const exceededCategories = sortCategoriesWithKeys(subscription?.categories ?? {})
    .filter(
      ([category]) =>
        category !== DataCategory.SPANS_INDEXED || subscription?.hadCustomDynamicSampling
    )
    .reduce((acc, [category, currentHistory]) => {
      if (currentHistory.usageExceeded) {
        if (
          subscription.onDemandMaxSpend === 0 &&
          (!currentHistory.reserved || currentHistory.reserved <= 1)
        ) {
          // don't show any categories without additional reserved volumes
          // if there is no PAYG
          return acc;
        }
        acc.push(category);
      }
      return acc;
    }, [] as string[]);
  const promptsToCheck = exceededCategories
    .map(category => {
      const categoryInfo = getCategoryInfoFromPlural(category as DataCategory);
      return `${categoryInfo?.snakeCasePlural ?? category}_overage_alert`;
    })
    .filter(Boolean);

  const {isLoading, isError, isPromptDismissed, snoozePrompt, showPrompt} = usePrompts({
    features: promptsToCheck,
    organization,
    daysToSnooze: -1 * getDaysSinceDate(subscription.onDemandPeriodEnd),
    options: {
      enabled: promptsToCheck.length > 0,
    },
  });

  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryButtonOverlay({});
  const prefersStackedNav = usePrefersStackedNav();
  const theme = useTheme();
  const prefersDarkMode = useLegacyStore(ConfigStore).theme === 'dark';
  const iconColor = prefersDarkMode ? theme.background : theme.textColor;

  const shouldShow =
    prefersStackedNav &&
    exceededCategories.length > 0 &&
    subscription.canSelfServe &&
    !subscription.hasOverageNotificationsDisabled;
  if (!shouldShow || isLoading || isError) {
    return null;
  }

  const onCheckboxChange = ({
    checked,
    eventTypes,
    isManual = false,
  }: {
    checked: boolean;
    eventTypes: EventType[];
    isManual?: boolean;
  }) => {
    promptsToCheck.forEach(prompt => {
      if (checked) {
        snoozePrompt(prompt);
      } else {
        showPrompt(prompt);
      }
    });
    if (isManual) {
      const analyticsEvent = checked
        ? 'quota_alert.clicked_snooze'
        : 'quota_alert.clicked_unsnooze';
      trackGetsentryAnalytics(analyticsEvent, {
        organization,
        subscription,
        event_types: eventTypes?.sort().join(','),
        is_warning: false,
        source: 'nav-quota-overage',
      });
    }
  };

  const hasSnoozedAllPrompts = () => {
    return Object.values(isPromptDismissed).every(Boolean);
  };

  return (
    <Fragment>
      <SidebarButton
        analyticsKey="billingStatus"
        label={t('Billing Status')}
        buttonProps={{...overlayTriggerProps, style: {backgroundColor: theme.warning}}}
      >
        <motion.div {...(isOpen || hasSnoozedAllPrompts() ? {} : ANIMATE_PROPS)}>
          <IconWarning color={iconColor as Color} />
        </motion.div>
      </SidebarButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <QuotaExceededContent
            exceededCategories={exceededCategories}
            subscription={subscription}
            organization={organization}
            isDismissed={hasSnoozedAllPrompts()}
            onCheck={onCheckboxChange}
          />
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}

export default withSubscription(PrimaryNavigationQuotaExceeded, {noLoader: true});

const Container = styled('div')`
  background: ${p => p.theme.background};
`;

const Header = styled('div')`
  background: ${p => p.theme.background};
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const HeaderTitle = styled('h1')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: 0;
`;

const Title = styled('h2')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: 0;
`;

const Body = styled('div')`
  margin: ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
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

const DismissContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const CheckboxLabel = styled('span')`
  margin-left: ${space(1)};
`;
