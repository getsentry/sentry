import {Client} from 'sentry/api';
import {
  Organization,
  PageFilters,
  ReleaseWithHealth,
  SessionDisplayTags,
  SessionDisplayYAxis,
} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

import ReleaseChart from './releaseChart';
import SessionsQuery from './sessionsQuery';

type Props = {
  api: Client;
  groupBy: SessionDisplayTags;
  organization: Organization;
  release: ReleaseWithHealth;
  selection: PageFilters;
  yAxis: SessionDisplayYAxis;
};

function ReleaseChartContainer({
  api,
  groupBy,
  yAxis,
  organization,
  selection,
  release,
}: Props) {
  return (
    <SessionsQuery
      api={api}
      groupBy={groupBy}
      release={release}
      organization={organization}
      selection={selection}
      yAxis={yAxis}
    >
      {({loading, reloading, seriesResult}) => (
        <ReleaseChart
          loading={loading}
          reloading={reloading}
          series={seriesResult ?? []}
          yAxis={yAxis}
          selection={selection}
        />
      )}
    </SessionsQuery>
  );
}

export default withApi(ReleaseChartContainer);
