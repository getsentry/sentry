import {useEffect, useState} from 'react';

import {doSessionsRequest} from 'sentry/actionCreators/sessions';
import {Client} from 'sentry/api';
import {getInterval} from 'sentry/components/charts/utils';
import {
  Organization,
  PageFilters,
  ReleaseWithHealth,
  SessionDisplayTags,
  SessionDisplayYAxis,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {transformSessionsResponseToSeries} from 'sentry/views/dashboardsV2/widgetCard/transformSessionsResponseToSeries';

type ChildrenProps = {
  loading: boolean;
  errorMessage?: string;
  seriesResult?: Series[];
};

type Props = {
  api: Client;
  children: (props: ChildrenProps) => JSX.Element;
  groupBy: SessionDisplayTags;
  organization: Organization;
  release: ReleaseWithHealth;
  selection: PageFilters;
  yAxis: SessionDisplayYAxis;
};

function SessionsQuery({
  api,
  children,
  groupBy,
  yAxis,
  organization,
  selection,
  release,
}: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [seriesResult, setSeriesResult] = useState<Series[] | undefined>(undefined);

  const {datetime, environments, projects} = selection;
  const {start, end, period} = datetime;

  const interval = getInterval(datetime);

  useEffect(() => {
    let mounted = true;
    setErrorMessage(undefined);
    setLoading(true);

    const requestData = {
      field: [yAxis],
      orgSlug: organization.slug,
      end,
      environment: environments,
      groupBy: groupBy === SessionDisplayTags.ALL ? [] : [groupBy.valueOf()],
      limit: undefined,
      orderBy: `-${yAxis}`,
      interval,
      project: projects,
      query: `release:${release.version}`,
      start,
      statsPeriod: period,
      includeAllArgs: true,
    };

    doSessionsRequest(api, requestData)
      .then(series => {
        if (mounted) {
          const transformed = transformSessionsResponseToSeries(series[0], [], []);
          setSeriesResult(transformed);
          setLoading(false);
        }
      })
      .catch(e => {
        if (mounted) {
          setErrorMessage(e);
          setLoading(false);
        }
      });

    return () => {
      // Prevent setState leaking on unmounted component
      mounted = false;
    };
  }, [
    yAxis,
    organization.slug,
    environments,
    groupBy,
    start,
    end,
    period,
    interval,
    release.version,
  ]);

  return children({loading, errorMessage, seriesResult});
}

export default SessionsQuery;
