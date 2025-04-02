import {Fragment, useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion, type MotionProps} from 'framer-motion';

import {promptsUpdate, usePromptsCheck} from 'sentry/actionCreators/prompts';
import {Checkbox} from 'sentry/components/core/checkbox';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
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

function QuotaExceededContent({
  exceededCategories,
  subscription,
  organization,
  onDismiss,
  isDismissed,
}: {
  exceededCategories: string[];
  isDismissed: boolean;
  onDismiss: () => void;
  organization: Organization;
  subscription: Subscription;
}) {
  const eventTypes: EventType[] = exceededCategories.map(category => {
    const categoryInfo = getCategoryInfoFromPlural(category as DataCategory);
    return (categoryInfo?.plural ?? category) as EventType;
  });
  return (
    <Container>
      <Header>
        <HeaderTitle>{t('Status')}</HeaderTitle>
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
            referrer={`overage-alert-sidebar-${eventTypes.join('-')}`}
            source="quota-overage"
            handleRequestSent={() => {}}
          />
          <DismissContainer>
            <Checkbox
              name="dismiss"
              checked={isDismissed}
              disabled={isDismissed}
              onChange={() => {
                onDismiss();
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
  const exceededCategories = useMemo(() => {
    return sortCategoriesWithKeys(subscription?.categories ?? {})
      .filter(
        ([category]) =>
          category !== DataCategory.SPANS_INDEXED ||
          subscription?.hadCustomDynamicSampling
      )
      .reduce((acc, [category, currentHistory]) => {
        if (currentHistory.usageExceeded) {
          acc.push(category);
        }
        return acc;
      }, [] as string[]);
  }, [subscription.categories, subscription.hadCustomDynamicSampling]);

  const promptsToCheck = useMemo(() => {
    return exceededCategories
      .map(category => {
        const categoryInfo = getCategoryInfoFromPlural(category as DataCategory);
        if (categoryInfo) {
          return `${categoryInfo.snakeCasePlural ?? category}_overage_alert`;
        }
        return null;
      })
      .filter(Boolean) as string[];
  }, [exceededCategories]);

  const prompts = usePromptsCheck(
    {
      organization,
      feature: promptsToCheck,
    },
    {staleTime: 0}
  );

  const promptIsDismissedForBillingPeriod = useCallback(
    (prompt: {dismissed_ts?: number; snoozed_ts?: number}) => {
      const {snoozed_ts, dismissed_ts} = prompt || {};
      const time = snoozed_ts || dismissed_ts;
      if (!time) {
        return false;
      }
      const onDemandPeriodEnd = new Date(subscription.onDemandPeriodEnd);
      onDemandPeriodEnd.setHours(23, 59, 59);
      return time <= onDemandPeriodEnd.getTime() / 1000;
    },
    [subscription.onDemandPeriodEnd]
  );

  const allDismissedForPeriod = useMemo(() => {
    return (
      !!prompts.data &&
      !!prompts.data &&
      promptsToCheck.every(prompt => {
        const promptData = prompts.data.features?.[prompt];
        return promptData && promptIsDismissedForBillingPeriod(promptData);
      })
    );
  }, [prompts.data, promptsToCheck, promptIsDismissedForBillingPeriod]);

  const [isDismissed, setIsDismissed] = useState(allDismissedForPeriod);

  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
    state: overlayState,
  } = usePrimaryButtonOverlay({defaultOpen: !allDismissedForPeriod && !isDismissed});
  const theme = useTheme();

  const api = useApi();

  const shouldShow =
    usePrefersStackedNav() &&
    exceededCategories.length > 0 &&
    !subscription.hasOverageNotificationsDisabled;
  if (!shouldShow) {
    return null;
  }

  const animateProps: MotionProps = {
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

  return (
    <Fragment>
      <SidebarButton
        analyticsKey="quotaExceeded"
        label={t('Billing Overage')}
        buttonProps={{...overlayTriggerProps, style: {backgroundColor: theme.warning}}}
      >
        <motion.div {...(isOpen || isDismissed ? {} : animateProps)}>
          <IconWarning />
        </motion.div>
      </SidebarButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <QuotaExceededContent
            exceededCategories={exceededCategories}
            subscription={subscription}
            organization={organization}
            isDismissed={isDismissed}
            onDismiss={() => {
              promptsToCheck.forEach(prompt => {
                promptsUpdate(api, {
                  organization,
                  feature: prompt,
                  status: 'dismissed',
                });
              });
              setIsDismissed(true);
              overlayState.close();
            }}
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
  background: ${p => p.theme.warning};
  padding: ${space(2)};
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
`;

const CheckboxLabel = styled('span')`
  margin-left: ${space(1)};
`;
