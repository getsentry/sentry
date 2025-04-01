import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {promptsUpdate, usePromptsCheck} from 'sentry/actionCreators/prompts';
import {Checkbox} from 'sentry/components/core/checkbox';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';
import {SidebarButton} from 'sentry/views/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/views/nav/primary/primaryButtonOverlay';

import AddEventsCTA, {type EventType} from 'getsentry/components/addEventsCTA';
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
  organization,
  exceededCategories,
  isDismissed,
  onDismiss,
}: {
  exceededCategories: string[];
  isDismissed: boolean;
  onDismiss: () => void;
  organization: Organization;
  subscription: Subscription;
}) {
  const api = useApi();
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
            api={api}
            organization={organization}
            subscription={subscription}
            buttonProps={{
              size: 'xs',
            }}
            eventTypes={eventTypes}
            notificationType="overage_critical"
            referrer={`overage-alert-sidebar-${eventTypes.join('-')}`}
            source="quota-overage"
            handleRequestSent={onDismiss}
          />
          <DismissContainer>
            <Checkbox
              name="dismiss"
              checked={isDismissed}
              disabled={isDismissed}
              onChange={onDismiss}
            />
            <CheckboxLabel>{t("Don't annoy me again")}</CheckboxLabel>
          </DismissContainer>
        </ActionContainer>
      </Body>
    </Container>
  );
}

function QuotaExceededSidebarButton({
  subscription,
  organization,
  exceededCategories,
  promptsToCheck,
  prompts,
}: {
  exceededCategories: string[];
  organization: Organization;
  prompts: {
    [key: string]: {dismissed_ts?: number; snoozed_ts?: number};
  };
  promptsToCheck: string[];
  subscription: Subscription;
}) {
  // const promptIsDismissedForBillingPeriod = (prompt: {
  //   dismissed_ts?: number;
  //   snoozed_ts?: number;
  // }) => {
  //   const {snoozed_ts, dismissed_ts} = prompt || {};
  //   // TODO: dismissed prompt should always return false
  //   const time = snoozed_ts || dismissed_ts;
  //   if (!time) {
  //     return false;
  //   }
  //   const onDemandPeriodEnd = new Date(subscription.onDemandPeriodEnd);
  //   onDemandPeriodEnd.setHours(23, 59, 59);
  //   return time <= onDemandPeriodEnd.getTime() / 1000;
  // };
  const [hasDismissed, setHasDismissed] = useState(false);
  const theme = useTheme();
  const api = useApi();

  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryButtonOverlay();

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
        <motion.div animate={{rotate: 360}}>
          <IconWarning />
        </motion.div>
      </StyledSidebarButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <QuotaExceededDetails
            organization={organization}
            subscription={subscription}
            exceededCategories={exceededCategories}
            onDismiss={() => {
              promptsToCheck
                .filter(feature => !prompts[feature])
                .forEach(feature =>
                  promptsUpdate(api, {
                    organization,
                    feature,
                    status: 'snoozed',
                  })
                );
              setHasDismissed(true);
            }}
            isDismissed={hasDismissed}
          />
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}

function QuotaExceededSidebarItem({subscription, organization}: Props) {
  const sortedCategories = sortCategories(subscription.categories ?? {});
  const exceededCategories = sortedCategories
    .filter(({usageExceeded}) => usageExceeded)
    .map(({category}) => category);

  const promptsToCheck =
    exceededCategories.length > 0
      ? (exceededCategories
          .map(category => {
            const categoryInfo = getCategoryInfoFromPlural(category as DataCategory);
            if (categoryInfo) {
              return `${categoryInfo.snakeCasePlural ?? categoryInfo.plural}_overage_alert`;
            }
            return null;
          })
          .filter(Boolean) as string[])
      : ['errors_overage_alert'];

  const {data, isPending, isError} = usePromptsCheck(
    {
      feature: promptsToCheck,
      organization,
    }
    // {staleTime: 0}
  );

  if (isPending || isError || !prefersStackedNav() || exceededCategories.length === 0) {
    return null;
  }

  const prompts = (data?.features ?? {}) as {
    [key: string]: {dismissed_ts?: number; snoozed_ts?: number};
  };

  return (
    <QuotaExceededSidebarButton
      subscription={subscription}
      organization={organization}
      exceededCategories={exceededCategories}
      prompts={prompts}
      promptsToCheck={promptsToCheck}
    />
  );
}

export default withSubscription(QuotaExceededSidebarItem, {noLoader: true});

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
