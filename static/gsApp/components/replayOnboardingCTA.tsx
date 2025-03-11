import type {ReactNode} from 'react';
import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import useDismissAlert from 'sentry/utils/useDismissAlert';

import {
  openAM2UpsellModal,
  openAM2UpsellModalSamePrice,
} from 'getsentry/actionCreators/modal';
import {sendReplayOnboardRequest} from 'getsentry/actionCreators/upsell';
import usePreviewData from 'getsentry/components/upgradeNowModal/usePreviewData';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

import {redirectToManage} from './upgradeNowModal/utils';

type ReplayOnboardingCTAUpsellProps = {
  organization: Organization;
  subscription: Subscription;
};

function ReplayOnboardingCTAUpsell({
  organization,
  subscription,
}: ReplayOnboardingCTAUpsellProps) {
  const hasBillingAccess = organization.access?.includes('org:billing');

  const api = useApi();
  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:dismiss-replay-update-plan-button`,
    expirationDays: 14,
  });

  useEffect(() => {
    trackGetsentryAnalytics('replay.list_page.viewed', {
      organization,
      surface: 'replay_onboarding_banner',
      planTier: subscription.planTier,
      canSelfServe: subscription.canSelfServe,
      channel: subscription.channel,
      has_billing_scope: organization.access?.includes('org:billing'),
    });
  }, [organization, subscription]);

  const onEmailOwner = useCallback(async () => {
    await sendReplayOnboardRequest({
      orgSlug: organization.slug,
      api,
      currentPlan: 'am1-non-beta',
      onSuccess: () => {
        dismiss();

        trackGetsentryAnalytics('replay.list_page.sent_email', {
          organization,
          surface: 'replay_onboarding_banner',
          planTier: subscription.planTier,
          canSelfServe: subscription.canSelfServe,
          channel: subscription.channel,
          has_billing_scope: organization.access?.includes('org:billing'),
        });
      },
    });
  }, [api, organization, subscription, dismiss]);

  const [didClickOpenModal, setDidClickOpenModal] = useState<boolean>();
  const previewData = usePreviewData({
    organization,
    subscription,
    enabled: !subscription.canSelfServe || !hasBillingAccess,
  });

  const handleOpenModal = useCallback(() => {
    setDidClickOpenModal(true);
  }, []);

  // Once we have 1) previewData, and 2) the user clicked the button; then open the modal
  useEffect(() => {
    if (!didClickOpenModal || previewData.loading) {
      return;
    }

    if (previewData.error) {
      if (hasBillingAccess) {
        // Redirect the user to the subscriptions page, where they will find important information.
        // If they wish to update their plan, we ask them to contact our sales/support team.
        redirectToManage(organization);
      }
      return;
    }

    setDidClickOpenModal(false);
    const onComplete = () => {
      dismiss();
      trackGetsentryAnalytics('replay.list_page.open_modal', {
        organization,
        surface: 'replay_onboarding_banner',
        planTier: subscription.planTier,
        canSelfServe: subscription.canSelfServe,
        channel: subscription.channel,
        has_billing_scope: hasBillingAccess,
        has_price_change: previewData.previewData.billedAmount !== 0,
      });
    };
    if (hasBillingAccess && previewData.previewData.billedAmount === 0) {
      openAM2UpsellModalSamePrice({
        organization,
        subscription,
        onComplete: () => {
          window.location.hash = 'replay-sidequest';
          SidebarPanelStore.activatePanel(SidebarPanelKey.REPLAYS_ONBOARDING);
          onComplete();
        },
        surface: 'replay',
        ...previewData,
      });
    } else {
      openAM2UpsellModal({
        organization,
        subscription,
        isActionDisabled: isDismissed,
        onComplete,
        surface: 'replay',
        ...previewData,
      });
    }
  }, [
    dismiss,
    didClickOpenModal,
    hasBillingAccess,
    isDismissed,
    organization,
    previewData,
    subscription,
  ]);

  const onClickManageSubscription = useCallback(() => {
    trackGetsentryAnalytics('replay.list_page.manage_sub', {
      organization,
      surface: 'replay_onboarding_banner',
      planTier: subscription.planTier,
      canSelfServe: subscription.canSelfServe,
      channel: subscription.channel,
      has_billing_scope: organization.access?.includes('org:billing'),
    });
  }, [organization, subscription]);

  if (!subscription.canSelfServe) {
    // Two cases:
    // 1. Touch sales -> They need to call sales.
    // 2. Managed/Partner accounts, that are not AM2 -> no update path. They're stuck for now.
    // In either case the Subscription Overview page has a note about what options are available.

    return (
      <Fragment>
        <h3>{t('Get to the root cause faster')}</h3>
        {subscription.channel === 'sales' ? null : (
          <p>{t('Your current plan doesn’t support Session Replay.')}</p>
        )}
        <p>
          {t(
            'Session Replay is a video-like reproduction of user interactions including page visits, mouse movements, clicks, and scrolls on a site or web app.'
          )}
        </p>
        <ButtonList gap={1}>
          <Button
            to={`/settings/${organization.slug}/billing/overview/?referrer=replay_onboard-managed-cta`}
            onClick={onClickManageSubscription}
            priority="primary"
          >
            {t('Manage Subscription')}
          </Button>
          <LinkButton href="https://docs.sentry.io/product/session-replay/" external>
            {t('Read Docs')}
          </LinkButton>
        </ButtonList>
      </Fragment>
    );
  }

  if ([PlanTier.MM1, PlanTier.MM2].includes(subscription.planTier as PlanTier)) {
    // MM1 & MM2 plans have no direct update path into AM2, prices could be wildly different
    // Members get an email, owners get to Manage Subscription
    return (
      <Fragment>
        <h3>{t('Get to the root cause faster')}</h3>
        <p>
          {t(
            'Update to the latest version of your plan to get access to Session Replay and get video-like reproduction of user interactions including page visits, mouse movements, clicks, and scrolls on a site or web app.'
          )}
        </p>
        <ButtonList gap={1}>
          {hasBillingAccess ? (
            <Button
              to={`/settings/${organization.slug}/billing/overview/?referrer=replay_onboard_mmx-cta`}
              onClick={onClickManageSubscription}
              priority="primary"
            >
              {t('Manage Subscription')}
            </Button>
          ) : (
            <Button disabled={isDismissed} onClick={onEmailOwner} priority="primary">
              {t('Request to Update Plan')}
            </Button>
          )}
          <LinkButton href="https://docs.sentry.io/product/session-replay/" external>
            {t('Read Docs')}
          </LinkButton>
        </ButtonList>
      </Fragment>
    );
  }

  // AM1 orgs get a Modal which includes the one-click "Update Now" button
  return (
    <Fragment>
      <h3>{t('Get to the root cause faster')}</h3>
      <p>
        {t(
          'Update to the latest version of your plan to get access to Session Replay and get video-like reproduction of user interactions including page visits, mouse movements, clicks, and scrolls on a site or web app.'
        )}
      </p>
      {hasBillingAccess ? null : (
        <p>{t('Notify your organization owner to start using Session Replay.')}</p>
      )}
      <ButtonList gap={1}>
        {hasBillingAccess ? (
          <Button
            onClick={handleOpenModal}
            priority="primary"
            disabled={didClickOpenModal && previewData.loading}
          >
            {t('Set Up Replays')}
          </Button>
        ) : (
          <Button disabled={isDismissed} onClick={onEmailOwner} priority="primary">
            {t('Notify Owner')}
          </Button>
        )}

        <LinkButton href="https://docs.sentry.io/product/session-replay/" external>
          {t('Read Docs')}
        </LinkButton>
      </ButtonList>
    </Fragment>
  );
}

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

type ReplayOnboardingCTAProps = {
  children: ReactNode;
  organization: Organization;
  subscription: Subscription;
};

/**
 * The majority of orgs have the replays feature, so we check for that first
 */
function ReplayOnboardingCTA(props: ReplayOnboardingCTAProps) {
  const hasReplaysFeature = props.organization.features.includes('session-replay');
  if (hasReplaysFeature) {
    // AM2 orgs are ready to go, show the open source "Setup Replay SDK onboarding" panel
    // Also, any org that is trialing any AM2 plan is ready to go
    return <Fragment>{props.children}</Fragment>;
  }

  return <ReplayOnboardingCTAUpsell {...props} />;
}

export default withSubscription(ReplayOnboardingCTA, {noLoader: true});
