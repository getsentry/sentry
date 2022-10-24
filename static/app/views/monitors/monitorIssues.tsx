import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import {Panel, PanelBody} from 'sentry/components/panels';
import {t} from 'sentry/locale';

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
  return (
    <GroupList
      orgId={orgId}
      endpointPath={`/organizations/${orgId}/issues/`}
      queryParams={{
        query: `monitor.id:"${monitor.id}"`,
        project: monitor.project.id,
        limit: 5,
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
