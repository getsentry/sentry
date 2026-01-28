import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';

type Props = {
  check: UptimeCheck;
  project: Project;
};

export function UptimeCheckDetails({check, project}: Props) {
  const {
    data: traceItemData,
    isPending: isTraceItemPending,
    isError: isTraceItemError,
  } = useTraceItemDetails({
    traceItemId: check.uptimeCheckId,
    projectId: project.id.toString(),
    traceId: check.traceId,
    traceItemType: TraceItemDataset.UPTIME_RESULTS,
    referrer: 'api.explore.log-item-details', // TODO: change to span details
    enabled: true,
  });

  console.log(check);
  if (isTraceItemPending) {
    return <LoadingIndicator />;
  }

  if (isTraceItemError) {
    return <LoadingError message={t('Failed to fetch trace item details')} />;
  }

  return <div>uptimeCheckDetails</div>;
}
