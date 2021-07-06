import IssueList from 'app/components/issueList';
import {t} from 'app/locale';

import {Monitor} from './types';

type Props = {
  orgId: string;
  monitor: Monitor;
};

const MonitorIssues = ({orgId, monitor}: Props) => (
  <IssueList
    endpoint={`/organizations/${orgId}/issues/`}
    query={{
      query: 'monitor.id:"' + monitor.id + '"',
      project: monitor.project.id,
      limit: 5,
    }}
    pagination={false}
    emptyText={t('No issues found')}
    noBorder
    noMargin
  />
);

export default MonitorIssues;
