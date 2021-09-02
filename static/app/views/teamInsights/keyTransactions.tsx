import {Location} from 'history';

import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import Table from 'app/views/performance/table';

type Props = {
  organization: Organization;
  projects: Project[];
  location: Location;
  period?: string;
  start?: string;
  end?: string;
};

function TeamKeyTransactions({
  organization,
  projects,
  location,
  period,
  start,
  end,
}: Props) {
  const eventView = EventView.fromSavedQuery({
    id: undefined,
    name: 'Performance',
    query: 'transaction.duration:<15m team_key_transaction:true',
    projects: projects.map(project => Number(project.id)),
    version: 2,
    orderby: '-tpm',
    range: period,
    start,
    end,
    fields: [
      'team_key_transaction',
      'transaction',
      'project',
      'tpm()',
      'p50()',
      'p95()',
      'failure_rate()',
      'apdex()',
      'count_unique(user)',
      'count_miserable(user)',
      'user_misery()',
    ],
  });

  return (
    <Table
      eventView={eventView}
      projects={projects}
      organization={organization}
      location={location}
      setError={() => {}}
      summaryConditions={eventView.getQueryWithAdditionalConditions()}
    />
  );
}

export default TeamKeyTransactions;
