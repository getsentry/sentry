import uniq from 'lodash/uniq';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {MonitorCheckInsGrid} from 'sentry/views/insights/crons/components/monitorCheckInsGrid';
import {useMonitorCheckIns} from 'sentry/views/insights/crons/utils/useMonitorCheckIns';
import {EventListTable} from 'sentry/views/issueDetails/streamline/eventListTable';
import {useCronIssueAlertId} from 'sentry/views/issueDetails/streamline/issueCronCheckTimeline';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

export default function GroupCheckIns() {
  const organization = useOrganization();
  const {groupId} = useParams<{groupId: string}>();
  const location = useLocation();
  const cronAlertId = useCronIssueAlertId({groupId});

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId});

  const canFetchMonitorCheckIns =
    Boolean(organization.slug) && Boolean(group?.project.slug) && Boolean(cronAlertId);

  const {cursor, ...locationQuery} = location.query;
  const {
    data: checkIns = [],
    isPending: isDataPending,
    getResponseHeader,
  } = useMonitorCheckIns(
    {
      orgSlug: organization.slug,
      projectSlug: group?.project.slug ?? '',
      monitorIdOrSlug: cronAlertId ?? '',
      limit: 50,
      cursor: decodeScalar(cursor),
      queryParams: locationQuery,
    },
    {enabled: canFetchMonitorCheckIns}
  );

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  if (isGroupPending) {
    return <LoadingIndicator />;
  }

  const links = parseLinkHeader(getResponseHeader?.('Link') ?? '');
  const previousDisabled = links?.previous?.results === false;
  const nextDisabled = links?.next?.results === false;
  const pageCount = checkIns.length;

  const hasMultiEnv = uniq(checkIns.map(checkIn => checkIn.environment)).length > 0;

  return (
    <EventListTable
      title={t('All Check-Ins')}
      pagination={{
        tableUnits: t('check-ins'),
        links,
        pageCount,
        nextDisabled,
        previousDisabled,
      }}
    >
      <MonitorCheckInsGrid
        isLoading={isDataPending}
        checkIns={checkIns}
        hasMultiEnv={hasMultiEnv}
        project={group.project}
      />
    </EventListTable>
  );
}
