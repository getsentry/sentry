import type {ComponentProps} from 'react';
import {useCallback, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {closeModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import ErrorBoundary from 'sentry/components/errorBoundary';
import HighlightModalContainer from 'sentry/components/highlightModalContainer';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import OnboardingDrawerStore, {
  OnboardingDrawerKey,
} from 'sentry/stores/onboardingDrawerStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

import PlanTable from 'getsentry/components/upgradeNowModal/planTable';
import usePreviewData from 'getsentry/components/upgradeNowModal/usePreviewData';
import useUpgradeNowParams from 'getsentry/components/upgradeNowModal/useUpgradeNowParams';
import {redirectToManage} from 'getsentry/components/upgradeNowModal/utils';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = ModalRenderProps &
  Omit<ComponentProps<typeof ActionButtons>, 'hasPriceChange'> & {
    organization: Organization;
    subscription: Subscription;
  };

function UpsellModal(props: Props) {
  const {organization, subscription} = props;
  const hasBillingAccess = organization.access?.includes('org:billing');

  const {loading, reservations, previewData, error} = usePreviewData(props);

  useEffect(() => {
    if (error && hasBillingAccess) {
      // Redirect the user to the subscriptions page, where they will find important information.
      // If they wish to update their plan, we ask them to contact our sales/support team.
      redirectToManage(organization);
    }
  }, [error, hasBillingAccess, organization]);

  useEffect(() => {
    trackGetsentryAnalytics('upgrade_now.modal.viewed', {
      organization,
      planTier: subscription.planTier,
      canSelfServe: subscription.canSelfServe,
      channel: subscription.channel,
      has_billing_scope: organization.access?.includes('org:billing'),
      surface: 'profiling',
      // Disable `react-hooks/exhaustive-deps` because of this next line...
      // We want to track analytics right away, cannot wait for the network.
      has_price_change: loading ? undefined : previewData?.billedAmount !== 0,
    });
  }, [organization, subscription]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <HighlightModalContainer>
      <ModalLayout>
        <UpsellContent>
          <SubheaderPrimary>{t('Updates to Sentry')}</SubheaderPrimary>
          <Header>{t('Performance Monitoring and Profiling that scales')}</Header>
          <p>
            {t(
              'Get full visibility into the performance and stability of your application'
            )}
          </p>
          <List symbol="bullet">
            <ListItem>
              {t('Identify hot code paths to optimize resource consumption')}
            </ListItem>
            <ListItem>{t('See the exact functions causing performance issues')}</ListItem>
            <ListItem>
              <ExternalLink href="https://docs.sentry.io/product/data-management-settings/dynamic-sampling/">
                {t('Dynamically sample performance events at scale*')}
              </ExternalLink>
            </ListItem>
          </List>
          {loading || error ? (
            <Placeholder height="40px" />
          ) : (
            <ActionButtons {...props} hasPriceChange={previewData.billedAmount !== 0} />
          )}
          <Note>
            {t(
              '* Dynamic sampling kicks in for customers reserving 1M or more performance units a month'
            )}
          </Note>
        </UpsellContent>

        <div>
          <Subheader>{t('Plan Volume')}</Subheader>
          <ErrorBoundary mini>
            {loading || error ? (
              <Placeholder height="100%" />
            ) : (
              <PlanTable
                organization={organization}
                subscription={subscription}
                reservations={reservations}
                previewData={previewData}
              />
            )}
          </ErrorBoundary>
        </div>
      </ModalLayout>
    </HighlightModalContainer>
  );
}

const Subheader = styled('h2')`
  text-transform: uppercase;
  font-weight: bold;

  font-size: ${p => p.theme.fontSize.sm};
  margin-bottom: ${space(1)};
`;

const SubheaderPrimary = styled(Subheader)`
  color: ${p => p.theme.tokens.content.accent};
`;

const Header = styled('h1')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: bold;
  margin: ${space(1)} 0;
`;

const ModalLayout = styled('div')`
  display: grid;
  font-size: ${p => p.theme.fontSize.md};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr auto;
    gap: ${space(3)};
  }
`;

const UpsellContent = styled('div')`
  grid-column: 1;
  grid-row: 1;
  font-size: ${p => p.theme.fontSize.lg};
`;

const Note = styled('p')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.xs};
`;

export const modalCss = css`
  width: 100%;
  max-width: 980px;

  [role='document'] {
    position: relative;
    padding: 80px;
    overflow: hidden;
  }
`;

export default UpsellModal;

type ActionButtonsProps = {
  hasPriceChange: boolean;
  organization: Organization;
  subscription: Subscription;
  isActionDisabled?: boolean;
  onComplete?: () => void;
};

function ActionButtons({
  hasPriceChange,
  isActionDisabled,
  onComplete,
  organization,
  subscription,
}: ActionButtonsProps) {
  const api = useApi();
  const {plan, reservations} = useUpgradeNowParams({organization, subscription});

  const onUpdatePlan = useCallback(async () => {
    try {
      await api.requestPromise(`/customers/${organization.slug}/subscription/`, {
        method: 'PUT',
        data: {
          ...reservations,
          plan: plan?.id,
          referrer: 'profiling-am2-update-modal',
        },
      });

      SubscriptionStore.loadData(organization.slug, () => {
        if (onComplete) {
          onComplete();
        }
        closeModal();
        addSuccessMessage(t('Subscription Updated!'));

        OnboardingDrawerStore.open(OnboardingDrawerKey.PROFILING_ONBOARDING);

        trackGetsentryAnalytics('upgrade_now.modal.update_now', {
          organization,
          planTier: subscription.planTier,
          canSelfServe: subscription.canSelfServe,
          channel: subscription.channel,
          has_billing_scope: organization.access?.includes('org:billing'),
          surface: 'profiling',
          has_price_change: hasPriceChange,
        });
      });
    } catch (err) {
      Sentry.captureException(err);
      redirectToManage(organization);
    }
  }, [api, organization, subscription, plan, reservations, onComplete, hasPriceChange]);

  const onClickManageSubscription = useCallback(() => {
    trackGetsentryAnalytics('upgrade_now.modal.manage_sub', {
      organization,
      surface: 'profiling',
      planTier: subscription.planTier,
      canSelfServe: subscription.canSelfServe,
      channel: subscription.channel,
      has_billing_scope: organization.access?.includes('org:billing'),
    });
  }, [organization, subscription]);

  const hasBillingAccess = organization.access?.includes('org:billing');

  return hasBillingAccess ? (
    <ButtonRow>
      <Button
        priority="primary"
        onClick={onUpdatePlan}
        disabled={isActionDisabled === true}
      >
        {t('Update Now')}
      </Button>
      <LinkButton
        to={`/checkout/${organization.slug}/?referrer=profiling_onboard_modal-owner-modal`}
        onClick={onClickManageSubscription}
      >
        {t('Manage Subscription')}
      </LinkButton>
    </ButtonRow>
  ) : (
    <ButtonRow>
      <Button
        disabled
        title={t(
          'Only members with the role “Owner” or “Billing” can manage subscriptions'
        )}
      >
        {t('Manage Subscription')}
      </Button>
    </ButtonRow>
  );
}

const ButtonRow = styled('p')`
  display: flex;
  gap: ${space(1.5)};
  margin-top: ${space(3)};
  margin-bottom: ${space(2)};
`;
