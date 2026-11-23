import {useQuery} from '@tanstack/react-query';
import {useQueryState} from 'nuqs';

import {usePageFilterDates} from 'sentry/components/checkInTimeline/hooks/useMonitorDates';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useOrganization} from 'sentry/utils/useOrganization';
import {UptimeChecksGrid} from 'sentry/views/detectors/components/uptime/uptimeChecksGrid';
import {useDetectorQuery} from 'sentry/views/detectors/hooks';
import {parseAsScalar} from 'sentry/views/explore/queryParams/parsers';
import {uptimeChecksApiOptions} from 'sentry/views/insights/uptime/utils/uptimeChecksApiOptions';

import {EventListTable} from './eventListTable';
import {useGroupId} from './groupIdContext';
import {useUptimeIssueDetectorId} from './issueUptimeCheckTimeline';
import {useGroup} from './useGroup';

export default function GroupUptimeChecks() {
  const organization = useOrganization();
  const groupId = useGroupId();
  const [cursor] = useQueryState('cursor', parseAsScalar);
  const {since, until} = usePageFilterDates();
  const detectorId = useUptimeIssueDetectorId({groupId});

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId});

  const canFetchUptimeChecks =
    Boolean(organization.slug) && Boolean(group?.project.slug) && Boolean(detectorId);

  const {data: uptimeDetector} = useDetectorQuery<UptimeDetector>(detectorId ?? '', {
    enabled: canFetchUptimeChecks,
  });

  const {data} = useQuery({
    ...uptimeChecksApiOptions({
      orgSlug: organization.slug,
      projectSlug: group?.project.slug ?? '',
      detectorId: detectorId ?? '',
      cursor: cursor ?? undefined,
      limit: 50,
      start: since.toISOString(),
      end: until.toISOString(),
    }),
    enabled: canFetchUptimeChecks,
    select: selectJsonWithHeaders,
  });
  const uptimeChecks = data?.json;

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  if (isGroupPending || uptimeChecks === undefined || uptimeDetector === undefined) {
    return <LoadingIndicator />;
  }

  const links = parseLinkHeader(data?.headers.Link ?? '');
  const previousDisabled = links?.previous?.results === false;
  const nextDisabled = links?.next?.results === false;
  const pageCount = uptimeChecks.length;

  return (
    <EventListTable
      title={t('All Uptime Checks')}
      pagination={{
        tableUnits: t('uptime checks'),
        links,
        pageCount,
        nextDisabled,
        previousDisabled,
      }}
    >
      <UptimeChecksGrid
        traceSampling={uptimeDetector.dataSources[0].queryObj.traceSampling}
        uptimeChecks={uptimeChecks}
      />
    </EventListTable>
  );
}
