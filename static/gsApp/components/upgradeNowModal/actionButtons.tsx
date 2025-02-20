import {useCallback} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {closeModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

import {sendReplayOnboardRequest} from 'getsentry/actionCreators/upsell';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Plan, PreviewData, Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import type {AM2UpdateSurfaces} from 'getsentry/utils/trackGetsentryAnalytics';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

import type {Reservations} from './types';
import {redirectToManage} from './utils';

type Props = {
  organization: Organization;
  plan: Plan;
  previewData: PreviewData;
  reservations: Reservations;
  subscription: Subscription;
  surface: AM2UpdateSurfaces;
  isActionDisabled?: boolean;
  onComplete?: () => void;
};

function ActionButtons({
  isActionDisabled,
  onComplete,
  organization,
  plan,
  previewData,
  reservations,
  subscription,
  surface,
}: Props) {
  const api = useApi();

  const onUpdatePlan = useCallback(async () => {
    try {
      await api.requestPromise(`/customers/${organization.slug}/subscription/`, {
        method: 'PUT',
        data: {
          ...reservations,
          plan: plan?.id,
          referrer: 'replay-am2-update-modal',
        },
      });

      SubscriptionStore.loadData(organization.slug, () => {
        if (onComplete) {
          onComplete();
        }
        closeModal();
        addSuccessMessage(t('Subscription Updated!'));

        window.location.hash = 'replay-sidequest';
        SidebarPanelStore.activatePanel(SidebarPanelKey.REPLAYS_ONBOARDING);

        trackGetsentryAnalytics('upgrade_now.modal.update_now', {
          organization,
          planTier: subscription.planTier,
          canSelfServe: subscription.canSelfServe,
          channel: subscription.channel,
          has_billing_scope: organization.access?.includes('org:billing'),
          surface,
          has_price_change: previewData.billedAmount !== 0,
        });
      });
    } catch (err) {
      Sentry.captureException(err);
      redirectToManage(organization);
    }
  }, [
    api,
    onComplete,
    organization,
    plan,
    previewData.billedAmount,
    reservations,
    subscription,
    surface,
  ]);

  const onEmailOwner = useCallback(async () => {
    const currentPlanName =
      subscription.planTier === PlanTier.AM2 ? 'am2-non-beta' : 'am1-non-beta';

    await sendReplayOnboardRequest({
      api,
      orgSlug: organization.slug,
      currentPlan: currentPlanName,
      onSuccess: () => {
        onComplete?.();
        closeModal();
        trackGetsentryAnalytics('upgrade_now.modal.sent_email', {
          organization,
          surface,
          planTier: subscription.planTier,
          canSelfServe: subscription.canSelfServe,
          channel: subscription.channel,
          has_billing_scope: organization.access?.includes('org:billing'),
        });
      },
      onError: () => {
        redirectToManage(organization);
      },
    });
  }, [api, organization, subscription, surface, onComplete]);

  const onClickManageSubscription = useCallback(() => {
    trackGetsentryAnalytics('upgrade_now.modal.manage_sub', {
      organization,
      surface,
      planTier: subscription.planTier,
      canSelfServe: subscription.canSelfServe,
      channel: subscription.channel,
      has_billing_scope: organization.access?.includes('org:billing'),
    });
  }, [organization, subscription, surface]);

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
      <Button
        to={`/settings/${organization.slug}/billing/checkout/?referrer=replay_onboard_modal-owner-modal`}
        onClick={onClickManageSubscription}
      >
        {t('Manage Subscription')}
      </Button>
    </ButtonRow>
  ) : (
    <ButtonRow>
      <Button
        priority="primary"
        title={t('Notify an owner by email to update to the latest version of your plan')}
        onClick={onEmailOwner}
        disabled={isActionDisabled === true}
      >
        {t('Request to Update Plan')}
      </Button>
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

export default ActionButtons;
