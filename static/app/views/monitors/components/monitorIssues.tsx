import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import {Panel, PanelBody} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {getUtcDateString} from 'sentry/utils/dates';
import usePageFilters from 'sentry/utils/usePageFilters';

import {Monitor, MonitorEnvironment} from '../types';

type Props = {
  monitor: Monitor;
  monitorEnvs: MonitorEnvironment[];
  orgId: string;
};

function MonitorIssuesEmptyMessage() {
  return (
    <Panel>
      <PanelBody>
        <EmptyStateWarning>
          <p>{t('No issues relating to this cron monitor have been found.')}</p>
        </EmptyStateWarning>
      </PanelBody>
    </Panel>
  );
}

function MonitorIssues({orgId, monitor, monitorEnvs}: Props) {
  const {selection} = usePageFilters();
  const {start, end, period} = selection.datetime;
  const timeProps =
    start && end
      ? {
          start: getUtcDateString(start),
          end: getUtcDateString(end),
        }
      : {
          statsPeriod: period,
        };

  // TODO(epurkhiser): We probably want to filter on envrionemnt

  return (
    <GroupList
      orgId={orgId}
      endpointPath={`/organizations/${orgId}/issues/`}
      queryParams={{
        query: `monitor.slug:"${monitor.slug}" environment:[${monitorEnvs
          .map(e => e.name)
          .join(',')}]`,
        project: monitor.project.id,
        limit: 5,
        ...timeProps,
      }}
      query=""
      renderEmptyMessage={MonitorIssuesEmptyMessage}
      canSelectGroups={false}
      withPagination={false}
      withChart={false}
      useTintRow={false}
      source="monitors"
    />
  );
}

export default MonitorIssues;
