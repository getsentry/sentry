import {Client} from 'sentry/api';
import {
  CHART_TYPE_TO_YAXIS_MAP,
  Organization,
  PageFilters,
  ReleaseWithHealth,
  SessionDisplayTags,
} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

import ReleaseChart from './releaseChart';
import SessionsQuery from './sessionsQuery';

type Props = {
  api: Client;
  groupBy: SessionDisplayTags;
  organization: Organization;
  release: ReleaseWithHealth;
  selectedDisplay: string;
  selection: PageFilters;
};

function ReleaseChartContainer({
  api,
  groupBy,
  selectedDisplay,
  organization,
  selection,
  release,
}: Props) {
  const yAxis = CHART_TYPE_TO_YAXIS_MAP[selectedDisplay];
  return (
    <SessionsQuery
      api={api}
      groupBy={groupBy}
      release={release}
      organization={organization}
      selection={selection}
      yAxis={yAxis}
    >
      {({loading, seriesResult}) => (
        <ReleaseChart
          loading={loading}
          series={seriesResult ?? []}
          yAxis={yAxis}
          selection={selection}
        />
      )}
    </SessionsQuery>
  );
}

export default withApi(ReleaseChartContainer);
