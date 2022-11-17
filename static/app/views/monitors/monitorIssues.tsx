import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import {Panel, PanelBody} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {getUtcDateString} from 'sentry/utils/dates';
import usePageFilters from 'sentry/utils/usePageFilters';

import {Monitor} from './types';

type Props = {
  monitor: Monitor;
  orgId: string;
};

const MonitorIssuesEmptyMessage = () => (
  <Panel>
    <PanelBody>
      <EmptyStateWarning>
        <p>{t('No issues founds relating to this monitor')}</p>
      </EmptyStateWarning>
    </PanelBody>
  </Panel>
);

const MonitorIssues = ({orgId, monitor}: Props) => {
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

  return (
    <GroupList
      orgId={orgId}
      endpointPath={`/organizations/${orgId}/issues/`}
      queryParams={{
        query: `monitor.id:"${monitor.id}"`,
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
};

export default MonitorIssues;
