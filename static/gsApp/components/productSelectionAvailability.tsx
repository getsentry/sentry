import {useMemo} from 'react';

import Link from 'sentry/components/links/link';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {
  DisabledProducts,
  ProductSelectionProps,
} from 'sentry/components/onboarding/productSelection';
import {ProductSelection} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import withSubscription from 'getsentry/components/withSubscription';
import {useAM2ProfilingUpsellModal} from 'getsentry/hooks/useAM2ProfilingUpsellModal';
import {useAM2UpsellModal} from 'getsentry/hooks/useAM2UpsellModal';
import type {Subscription} from 'getsentry/types';

import {
  makeLinkToManageSubscription,
  makeLinkToOwnersAndBillingMembers,
} from './profiling/alerts';

function getDisabledProducts({
  organization,
  canSelfServe,
  showSessionReplayModal,
  showProfilingModal,
}: {
  canSelfServe: boolean;
  organization: Organization;
  showProfilingModal: () => void;
  showSessionReplayModal: () => void;
}): DisabledProducts {
  const disabledProducts: DisabledProducts = {};
  const hasSessionReplay = organization.features.includes('session-replay');
  const hasPerformance = organization.features.includes('performance-view');
  const hasProfiling = organization.features.includes('profiling-view');
  const hasBillingAccess = organization.access?.includes('org:billing');

  // if performance is not available, it means that users are on a MM* plan and we don't have an upsell modal to show.
  const shouldShowUpsellModals = hasPerformance && hasBillingAccess && canSelfServe;

  if (!hasPerformance) {
    const reason = hasBillingAccess
      ? t("To use Performance, update your organization's plan to its latest version.")
      : t(
          'To use Performance, request an owner in your organization to update its plan to the latest version.'
        );

    disabledProducts[ProductSolution.PERFORMANCE_MONITORING] = {
      reason,
    };
  }

  if (!hasSessionReplay) {
    const reason = canSelfServe
      ? hasBillingAccess
        ? t(
            "To use Session Replay, update your organization's plan to its latest version."
          )
        : tct(
            'To use Session Replay, request an owner in your organization to update its plan to the latest version. [link:See who can upgrade]',
            {
              link: (
                <Link
                  to={makeLinkToOwnersAndBillingMembers(
                    organization,
                    'profiling_onboarding_product-selector'
                  )}
                />
              ),
            }
          )
      : tct(
          "To use Session Replay, update your organization's plan to its latest version. [link:Manage subscription]",
          {
            link: (
              <Link
                to={makeLinkToManageSubscription(
                  organization,
                  'profiling_onboarding_product-selector'
                )}
              />
            ),
          }
        );

    disabledProducts[ProductSolution.SESSION_REPLAY] = {
      reason,
      onClick: shouldShowUpsellModals ? showSessionReplayModal : undefined,
    };
  }

  if (!hasProfiling) {
    const reason = canSelfServe
      ? hasBillingAccess
        ? t("To use Profiling, update your organization's plan to its latest version.")
        : tct(
            'To use Profiling, request an owner in your organization to update its plan to the latest version. [link:See who can upgrade]',
            {
              link: (
                <Link
                  to={makeLinkToOwnersAndBillingMembers(
                    organization,
                    'profiling_onboarding_product-selector'
                  )}
                />
              ),
            }
          )
      : tct(
          "To use Profiling, update your organization's plan to its latest version. [link:Manage subscription]",
          {
            link: (
              <Link
                to={makeLinkToManageSubscription(
                  organization,
                  'profiling_onboarding_product-selector'
                )}
              />
            ),
          }
        );

    disabledProducts[ProductSolution.PROFILING] = {
      reason,
      onClick: shouldShowUpsellModals ? showProfilingModal : undefined,
    };
  }

  return disabledProducts;
}

type Props = {
  subscription: Subscription;
} & Omit<ProductSelectionProps, 'disabledProducts'>;

function ProductSelectionAvailabilityContainer({
  organization,
  subscription,
  platform,
  onChange,
  onLoad,
}: Props) {
  // Disable requests for session replay upsell modal if the organization already has session replay
  const hasSessionReplay = organization.features.includes('session-replay');
  const sessionReplayUpsellModal = useAM2UpsellModal({
    subscription,
    surface: 'profiling',
    onComplete: () => {
      window.location.reload();
    },
    enabled: !hasSessionReplay,
  });

  const profilingUpsellModal = useAM2ProfilingUpsellModal({
    subscription,
    onComplete: () => {
      window.location.reload();
    },
  });

  const disabledProducts: DisabledProducts = useMemo(
    () =>
      getDisabledProducts({
        organization,
        canSelfServe: subscription.canSelfServe,
        showSessionReplayModal: sessionReplayUpsellModal.showModal,
        showProfilingModal: profilingUpsellModal.showModal,
      }),
    [organization, subscription, sessionReplayUpsellModal, profilingUpsellModal]
  );

  return (
    <ProductSelection
      organization={organization}
      disabledProducts={disabledProducts}
      platform={platform}
      onChange={onChange}
      onLoad={onLoad}
    />
  );
}

export const ProductSelectionAvailability = withSubscription(
  ProductSelectionAvailabilityContainer
);
