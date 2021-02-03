import React from 'react';

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
    statsPeriod="0"
    pagination={false}
    emptyText={t('No issues found')}
    showActions={false}
    noBorder
    noMargin
  />
);

export default MonitorIssues;
