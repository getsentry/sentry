import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Checkbox} from 'sentry/components/core/checkbox';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
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
}: {
  exceededCategories: string[];
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
              checked={false}
              disabled={false}
              onChange={() => {}}
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
  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryButtonOverlay({defaultOpen: true});
  const theme = useTheme();

  const exceededCategories = sortCategoriesWithKeys(subscription?.categories ?? {})
    .filter(
      ([category]) =>
        category !== DataCategory.SPANS_INDEXED || subscription?.hadCustomDynamicSampling
    )
    .reduce((acc, [category, currentHistory]) => {
      if (currentHistory.usageExceeded) {
        acc.push(category);
      }
      return acc;
    }, [] as string[]);

  const hasExceeded = Object.values(subscription.categories ?? {}).some(
    ({usageExceeded}) => usageExceeded
  );

  const shouldShow =
    usePrefersStackedNav() &&
    hasExceeded &&
    !subscription.hasOverageNotificationsDisabled;
  if (!shouldShow) {
    return null;
  }

  return (
    <Fragment>
      <SidebarButton
        analyticsKey="quotaExceeded"
        label={t('Quota Exceeded')}
        buttonProps={{...overlayTriggerProps, style: {backgroundColor: theme.warning}}}
      >
        <IconWarning />
      </SidebarButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <QuotaExceededContent
            exceededCategories={exceededCategories}
            subscription={subscription}
            organization={organization}
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
