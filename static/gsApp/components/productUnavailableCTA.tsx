import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

import {
  sendReplayOnboardRequest,
  sendUpgradeRequest,
} from 'getsentry/actionCreators/upsell';
import withSubscription from 'getsentry/components/withSubscription';
import {useAM2UpsellModal} from 'getsentry/hooks/useAM2UpsellModal';
import type {Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import type {ProductUnavailableUpsellAlert} from 'getsentry/utils/trackGetsentryAnalytics';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

function getUpdatePlanLabel({
  hasSessionReplay,
  hasPerformanceView,
}: {
  hasPerformanceView: boolean;
  hasSessionReplay: boolean;
}) {
  if (!hasSessionReplay && !hasPerformanceView) {
    return t(
      'Update your organization to the latest version of its plan to use Performance and Session Replay.'
    );
  }

  if (!hasSessionReplay) {
    return t(
      'Update your organization to the latest version of its plan to use Session Replay.'
    );
  }

  return t(
    'Update your organization to the latest version of its plan to use Performance.'
  );
}

function getRequestUpdateLabel({
  hasSessionReplay,
  hasPerformanceView,
}: {
  hasPerformanceView: boolean;
  hasSessionReplay: boolean;
}) {
  if (!hasSessionReplay && !hasPerformanceView) {
    return t(
      'To use Performance and Session Replay, request an owner in your organization to update its plan to the latest version.'
    );
  }

  if (!hasSessionReplay) {
    return t(
      'To use Session Replay, request an owner in your organization to update its plan to the latest version.'
    );
  }

  return t(
    'To use Performance, request an owner in your organization to update its plan to the latest version.'
  );
}

function RequestUpdateAlert({
  children,
  organization,
  isAncientPlan,
  hasPerformanceView,
  hasSessionReplay,
}: {
  children: React.ReactNode;
  hasPerformanceView: boolean;
  hasSessionReplay: boolean;
  isAncientPlan: boolean;
  organization: Organization;
}) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const analyticsCommonProps: ProductUnavailableUpsellAlert & {
    organization: Organization;
  } = useMemo(
    () => ({
      organization,
      has_performance: hasPerformanceView,
      has_session_replay: hasSessionReplay,
      action: 'request_update',
    }),
    [organization, hasPerformanceView, hasSessionReplay]
  );

  useEffect(() => {
    trackGetsentryAnalytics(
      'product_unavailable_upsell_alert.viewed',
      analyticsCommonProps
    );
  }, [analyticsCommonProps]);

  const handleClick = useCallback(async () => {
    setLoading(true);

    trackGetsentryAnalytics(
      'product_unavailable_upsell_alert_button.clicked',
      analyticsCommonProps
    );

    if (isAncientPlan) {
      await sendUpgradeRequest({
        api,
        organization,
        handleSuccess: () => setRequestSent(true),
      });
    } else {
      await sendReplayOnboardRequest({
        api,
        orgSlug: organization.slug,
        currentPlan: 'am1-non-beta',
        onSuccess: () => setRequestSent(true),
      });
    }

    setLoading(false);
  }, [api, isAncientPlan, organization, analyticsCommonProps]);

  return (
    <AlertWithCustomMargin
      system
      type="info"
      trailingItems={
        <Button
          size="xs"
          onClick={handleClick}
          busy={loading}
          disabled={requestSent}
          title={requestSent ? t('Request sent!') : undefined}
        >
          {t('Request Update')}
        </Button>
      }
    >
      {children}
    </AlertWithCustomMargin>
  );
}

function UpdatePlanAlert({
  children,
  organization,
  subscription,
  isAncientPlan,
  canSelfServe,
  hasPerformanceView,
  hasSessionReplay,
}: {
  canSelfServe: boolean;
  children: React.ReactNode;
  hasPerformanceView: boolean;
  hasSessionReplay: boolean;
  isAncientPlan: boolean;
  organization: Organization;
  subscription: Subscription;
}) {
  const am2UpsellModal = useAM2UpsellModal({
    subscription,
    surface: 'replay_project_creation',
    onComplete: () => {
      window.location.reload();
    },
  });

  const analyticsCommonProps: ProductUnavailableUpsellAlert & {
    organization: Organization;
  } = useMemo(
    () => ({
      organization,
      has_performance: hasPerformanceView,
      has_session_replay: hasSessionReplay,
      action: isAncientPlan || !canSelfServe ? 'manage_subscription' : 'update_plan',
    }),
    [organization, hasPerformanceView, hasSessionReplay, isAncientPlan, canSelfServe]
  );

  useEffect(() => {
    trackGetsentryAnalytics(
      'product_unavailable_upsell_alert.viewed',
      analyticsCommonProps
    );
  }, [analyticsCommonProps]);

  const handleClick = useCallback(() => {
    trackGetsentryAnalytics(
      'product_unavailable_upsell_alert_button.clicked',
      analyticsCommonProps
    );

    if (isAncientPlan || !canSelfServe) {
      return;
    }

    am2UpsellModal.showModal();
  }, [analyticsCommonProps, canSelfServe, isAncientPlan, am2UpsellModal]);

  return (
    <AlertWithCustomMargin
      type="info"
      system
      trailingItems={
        isAncientPlan || !canSelfServe ? (
          <LinkButton
            size="xs"
            to={`/settings/${organization.slug}/billing/overview/?referrer=replay_onboard_mmx-cta`}
            onClick={handleClick}
          >
            {t('Manage Subscription')}
          </LinkButton>
        ) : (
          <Button size="xs" onClick={handleClick}>
            {t('Update Plan')}
          </Button>
        )
      }
    >
      {children}
    </AlertWithCustomMargin>
  );
}

function ProductUnavailableCTAContainer({
  organization,
  subscription,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const hasSessionReplay = organization.features.includes('session-replay');
  const hasPerformanceView = organization.features.includes('performance-view');

  if (hasSessionReplay && hasPerformanceView) {
    return null;
  }

  // MM1 & MM2 plans have no direct update path into AM2, prices could be wildly different
  // Members can email owners requesting a plan upgrade and owners can manage subscription
  const isAncientPlan = [PlanTier.MM1, PlanTier.MM2].includes(
    subscription.planTier as PlanTier
  );

  const hasBillingAccess = organization.access?.includes('org:billing');
  const canSelfServe = subscription.canSelfServe;

  return hasBillingAccess ? (
    <UpdatePlanAlert
      subscription={subscription}
      organization={organization}
      isAncientPlan={isAncientPlan}
      canSelfServe={canSelfServe}
      hasSessionReplay={hasSessionReplay}
      hasPerformanceView={hasPerformanceView}
    >
      {getUpdatePlanLabel({hasSessionReplay, hasPerformanceView})}
    </UpdatePlanAlert>
  ) : (
    <RequestUpdateAlert
      hasSessionReplay={hasSessionReplay}
      hasPerformanceView={hasPerformanceView}
      organization={organization}
      isAncientPlan={isAncientPlan}
    >
      {getRequestUpdateLabel({hasSessionReplay, hasPerformanceView})}
    </RequestUpdateAlert>
  );
}

export const ProductUnavailableCTA = withSubscription(ProductUnavailableCTAContainer, {
  noLoader: true,
});

const AlertWithCustomMargin = styled(Alert)`
  margin: -${space(3)} -${space(4)} ${space(2)} -${space(4)};
`;
