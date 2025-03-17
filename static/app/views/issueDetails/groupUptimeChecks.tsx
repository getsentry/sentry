import {usePageFilterDates} from 'sentry/components/checkInTimeline/hooks/useMonitorDates';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {UptimeChecksGrid} from 'sentry/views/alerts/rules/uptime/uptimeChecksGrid';
import {useUptimeChecks} from 'sentry/views/insights/uptime/utils/useUptimeChecks';
import {EventListTable} from 'sentry/views/issueDetails/streamline/eventListTable';
import {useUptimeIssueAlertId} from 'sentry/views/issueDetails/streamline/issueUptimeCheckTimeline';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

import {useUptimeRule} from '../insights/uptime/utils/useUptimeRule';

export default function GroupUptimeChecks() {
  const organization = useOrganization();
  const {groupId} = useParams<{groupId: string}>();
  const location = useLocation();
  const {since, until} = usePageFilterDates();
  const uptimeAlertId = useUptimeIssueAlertId({groupId});

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId});

  const canFetchUptimeChecks =
    Boolean(organization.slug) && Boolean(group?.project.slug) && Boolean(uptimeAlertId);

  const {data: uptimeRule} = useUptimeRule(
    {
      projectSlug: group?.project.slug ?? '',
      uptimeRuleId: uptimeAlertId ?? '',
    },
    {enabled: canFetchUptimeChecks}
  );

  const {data: uptimeChecks, getResponseHeader} = useUptimeChecks(
    {
      orgSlug: organization.slug,
      projectSlug: group?.project.slug ?? '',
      uptimeAlertId: uptimeAlertId ?? '',
      cursor: decodeScalar(location.query.cursor),
      limit: 50,
      start: since.toISOString(),
      end: until.toISOString(),
    },
    {enabled: canFetchUptimeChecks}
  );

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  if (isGroupPending || uptimeChecks === undefined || uptimeRule === undefined) {
    return <LoadingIndicator />;
  }

  const links = parseLinkHeader(getResponseHeader?.('Link') ?? '');
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
      <UptimeChecksGrid uptimeRule={uptimeRule} uptimeChecks={uptimeChecks} />
    </EventListTable>
  );
}
