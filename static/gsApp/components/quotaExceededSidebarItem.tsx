import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {promptsUpdate, usePromptsCheck} from 'sentry/actionCreators/prompts';
import {Client} from 'sentry/api';
import {Button, LinkButton} from 'sentry/components/core/button';
import {prefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import {SidebarButton} from 'sentry/components/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/components/nav/primary/primaryButtonOverlay';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {lightTheme as theme} from 'sentry/utils/theme';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {getCategoryInfoFromPlural} from 'getsentry/utils/billing';
import {listDisplayNames, sortCategories} from 'getsentry/utils/dataCategory';

type Props = {
  organization: Organization;
  subscription: Subscription;
};

function QuotaExceededDetails({
  subscription,
  exceededCategories,
  onDismiss,
}: {
  exceededCategories: string[];
  onDismiss: () => void;
  subscription: Subscription;
}) {
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
        <ReviewSubscriptionButton to={`/settings/billing/`}>
          {t('Review Subscription')}
        </ReviewSubscriptionButton>
        <Button onClick={onDismiss} aria-label={t('Dismiss')}>
          {t('Dismiss')}
        </Button>
      </Body>
    </Container>
  );
}

function QuotaExceededSidebarItem({subscription, organization}: Props) {
  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryButtonOverlay();

  const exceededMetricHistories = useMemo(() => {
    return sortCategories(subscription?.categories ?? {}).filter(
      ({usageExceeded}) => usageExceeded
    );
  }, [subscription?.categories]);

  const promptsToCheck = useMemo(
    () =>
      exceededMetricHistories
        .map(metricHistory => {
          const categoryInfo = getCategoryInfoFromPlural(
            metricHistory.category as DataCategory
          );
          if (categoryInfo) {
            return `${categoryInfo.snakeCasePlural ?? categoryInfo.plural}_overage_alert`;
          }
          return null;
        })
        .filter(Boolean) as string[],
    [exceededMetricHistories]
  );

  const {data, isPending, isError} = usePromptsCheck(
    {
      feature: promptsToCheck,
      organization,
    },
    {staleTime: 0}
  );
  const prompts = useMemo(
    () =>
      (data?.features ?? {}) as {
        [key: string]: {dismissed_ts?: number; snoozed_ts?: number};
      },
    [data]
  );

  const promptIsDismissedForBillingPeriod = useCallback(
    (prompt: {dismissed_ts?: number; snoozed_ts?: number}) => {
      const {snoozed_ts, dismissed_ts} = prompt || {};
      // TODO: dismissed prompt should always return false
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

  const everyPromptIsDismissedForBillingPeriod = useMemo(
    () =>
      Object.keys(prompts).length > 0 &&
      Object.values(prompts).every(prompt => promptIsDismissedForBillingPeriod(prompt)),
    [prompts, promptIsDismissedForBillingPeriod]
  );

  const hasBillingPerms = organization.access?.includes('org:billing');
  const shouldForceOpen = useMemo(
    () => hasBillingPerms && !everyPromptIsDismissedForBillingPeriod,
    [hasBillingPerms, everyPromptIsDismissedForBillingPeriod]
  );

  const [hasDismissed, setHasDismissed] = useState(false);

  if (
    isPending ||
    isError ||
    !prefersStackedNav() ||
    exceededMetricHistories.length === 0
  ) {
    return null;
  }

  return (
    <Fragment>
      <StyledSidebarButton
        analyticsKey="quota_exceeded"
        label={t('Quota Exceeded')}
        buttonProps={{
          ...overlayTriggerProps,
          style: {backgroundColor: theme.warning},
        }}
      >
        <IconWarning />
      </StyledSidebarButton>
      {((shouldForceOpen && !hasDismissed) || isOpen) && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <QuotaExceededDetails
            subscription={subscription}
            exceededCategories={exceededMetricHistories.map(({category}) => category)}
            onDismiss={() => {
              promptsToCheck
                .filter(feature => !prompts[feature])
                .forEach(feature =>
                  promptsUpdate(new Client(), {
                    organization,
                    feature,
                    status: 'snoozed',
                  })
                );
              setHasDismissed(true);
            }}
          />
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}

export default withSubscription(QuotaExceededSidebarItem);

const StyledSidebarButton = styled(SidebarButton)`
  background: ${p => p.theme.warning};
`;

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

const ReviewSubscriptionButton = styled(LinkButton)`
  width: min-content;
`;
