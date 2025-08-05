import {Alert} from 'sentry/components/core/alert';
import {Link} from 'sentry/components/core/link';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {tct} from 'sentry/locale';
import {DataCategoryExact} from 'sentry/types/core';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {UsageSeries} from 'sentry/views/organizationStats/types';
import useUsageStatsQueryKey from 'sentry/views/organizationStats/useUsageStats';

import useSubscription from 'getsentry/hooks/useSubscription';

export function ReplayNeedsQuotaAlert() {
  const organization = useOrganization();

  return (
    <Alert type="warning">
      {tct(
        "Looks like you're using the base replay quota. [link:Upgrade now] to capture more data and make the most of Session Replay.",
        {
          link: <Link to={`/settings/${organization.slug}/billing/overview/`} />,
        }
      )}
    </Alert>
  );
}

export function useEnableNeedsQuotaAlert() {
  const subscription = useSubscription();

  const {selection} = usePageFilters();
  const projectIds = selection.projects.length
    ? selection.projects
    : [ALL_ACCESS_PROJECTS];

  const queryKey = useUsageStatsQueryKey({
    dataCategoryName: DataCategoryExact.REPLAY,
    dataDatetime: {period: DEFAULT_STATS_PERIOD},
    isSingleProject: true,
    projectIds,
  });
  const {data: projectStats} = useApiQuery<UsageSeries>(queryKey, {
    staleTime: Infinity,
  });

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

  const replayUse = projectStats?.groups.reduce(
    (sum, group) => sum + (group.totals['sum(quantity)'] ?? 0),
    0
  );
  if (!replayUse) {
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
