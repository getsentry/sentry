import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button, LinkButton} from '@sentry/scraps/button';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {closeModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {
  OnboardingDrawerKey,
  OnboardingDrawerStore,
} from 'sentry/stores/onboardingDrawerStore';
import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Plan, PreviewData, Subscription} from 'getsentry/types';
import type {AM2UpdateSurfaces} from 'getsentry/utils/trackGetsentryAnalytics';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

import type {Reservations} from './types';

type Props = {
  organization: Organization;
  plan: Plan;
  previewData: PreviewData;
  reservations: Reservations;
  subscription: Subscription;
  surface: AM2UpdateSurfaces;
  onComplete?: () => void;
};

export function ActionButtons({
  onComplete,
  organization,
  plan,
  previewData,
  reservations,
  subscription,
  surface,
}: Props) {
  const api = useApi();
  const navigate = useNavigate();

  const onUpdatePlan = async () => {
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
        OnboardingDrawerStore.open(OnboardingDrawerKey.REPLAYS_ONBOARDING);

        trackGetsentryAnalytics('upgrade_now.modal.update_now', {
          organization,
          canSelfServe: subscription.canSelfServe,
          channel: subscription.channel,
          has_billing_scope: organization.access?.includes('org:billing'),
          surface,
          has_price_change: previewData.billedAmount !== 0,
        });
      });
    } catch (err) {
      Sentry.captureException(err);
      navigate(
        normalizeUrl({
          pathname: `/checkout/${organization.slug}/`,
          query: {referrer: 'replay_upgrade_modal-update_plan-error'},
        }),
        {replace: true}
      );
    }
  };

  const onClickManageSubscription = () => {
    trackGetsentryAnalytics('upgrade_now.modal.manage_sub', {
      organization,
      surface,
      canSelfServe: subscription.canSelfServe,
      channel: subscription.channel,
      has_billing_scope: organization.access?.includes('org:billing'),
    });
  };

  return (
    <ButtonRow>
      <Button variant="primary" onClick={onUpdatePlan}>
        {t('Update Now')}
      </Button>
      <LinkButton
        to={`/checkout/${organization.slug}/?referrer=replay_onboard_modal-owner-modal`}
        onClick={onClickManageSubscription}
      >
        {t('Manage Subscription')}
      </LinkButton>
    </ButtonRow>
  );
}

const ButtonRow = styled('p')`
  display: flex;
  gap: ${p => p.theme.space.lg};
  margin-top: ${p => p.theme.space['2xl']};
  margin-bottom: ${p => p.theme.space.xl};
`;
