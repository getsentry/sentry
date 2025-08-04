import ReplayNeedsQuotaAlert from 'getsentry/components/replayNeedsQuotaAlert';
import useSubscription from 'getsentry/hooks/useSubscription';

export default function ReplayListPageHeader() {
  const isEnabled = useEnableNeedsQuotaAlert();
  if (isEnabled) {
    return <ReplayNeedsQuotaAlert />;
  }

  return null;
}

function useEnableNeedsQuotaAlert() {
  const subscription = useSubscription();

  const replaysCategory = subscription?.categories.replays;
  const replaysPlan = subscription?.planDetails.planCategories.replays;
  if (!subscription || !replaysCategory || !replaysPlan) {
    return false;
  }

  if (!subscription.canSelfServe) {
    // No need to upgrade if sales is involved already
    return false;
  }

  if (subscription.isTrial) {
    // No need to upgrade now if they are already on Trial
    return false;
  }

  if (!replaysCategory.usage) {
    // No need to upgrade if they're not using replay right now.
    // TODO: If this is only usage within the current pay period then we might
    // miss a chance to show the banner at the start of the pay-period before the
    // first replay is captured.
    return false;
  }

  const arePayingForReplays = replaysPlan.some(plan => plan.unitPrice !== 0);
  if (arePayingForReplays) {
    // No need to upgrade if their plan includes some replays.
    return false;
  }

  return true;
}
