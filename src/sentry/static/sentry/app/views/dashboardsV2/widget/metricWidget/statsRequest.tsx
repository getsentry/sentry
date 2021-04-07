import React, {useEffect, useState} from 'react';
import {Location} from 'history';
import pick from 'lodash/pick';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import {GlobalSelection, Organization, Project, SessionApiResponse} from 'app/types';
import {Series} from 'app/types/echarts';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {
  fillChartDataFromSessionsResponse,
  getInterval,
  getTotalsFromSessionsResponse,
  initSessionDurationChartData,
  initSessionsBreakdownChartData,
} from 'app/views/releases/detail/overview/chart/utils';
import {roundDuration} from 'app/views/releases/utils';

import {MetricQuery} from './types';

type Data = {
  chartData: Series[];
  chartSummary: React.ReactNode;
}[];

type ChildrenArgs = {
  isLoading: boolean;
  errored: boolean;
  data: Data;
};

type Props = {
  api: Client;
  organization: Organization;
  projectId: Project['id'];
  queries: MetricQuery[];
  environments: GlobalSelection['environments'];
  datetime: GlobalSelection['datetime'];
  location: Location;
  children: (args: ChildrenArgs) => React.ReactElement;
  yAxis?: string;
};

function StatsRequest({
  api,
  organization,
  projectId,
  queries,
  environments,
  datetime,
  location,
  children,
  yAxis,
}: Props) {
  const [errored, setErrored] = useState(false);
  const [data, setData] = useState<Data | undefined>(undefined);

  useEffect(() => {
    fetchData();
  }, [projectId, environments, datetime, queries, yAxis]);

  function fetchData() {
    if (!yAxis) {
      return;
    }

    const definedQueries = queries.filter(({aggregation}) => !!aggregation);

    const promises = definedQueries.map(({aggregation, groupBy, tags}) => {
      const tagsWithDoubleQuotes = tags
        .split(' ')
        .filter(tag => !!tag)
        .map(tag => {
          const [key, value] = tag.split(':');
          return `${key}:"${value}"`;
        });

      return api.requestPromise(`/organizations/${organization.slug}/sessions/`, {
        query: {
          project: projectId,
          environment: environments,
          query: stringifyQueryObject(new QueryResults(tagsWithDoubleQuotes)),
          groupBy,
          field: `${aggregation}(${yAxis})`,
          interval: getInterval(datetime),
          ...getParams(pick(location.query, Object.values(URL_PARAM))),
        },
      });
    });

    let completed = 0;
    const sessionReponses: SessionApiResponse[] = [];

    promises.forEach(async promise => {
      try {
        const rawResults = await promise;
        if (rawResults) {
          sessionReponses.push(rawResults);
        }
      } catch (error) {
        addErrorMessage(error.responseJSON?.detail ?? t('Error loading chart data'));
        setErrored(true);
      } finally {
        completed++;

        if (completed === promises.length) {
          getChartData(sessionReponses);
        }
      }
    });
  }

  function getChartData(sessionReponses: SessionApiResponse[]) {
    if (!sessionReponses.length || !yAxis) {
      return;
    }

    const newData = sessionReponses.map((sessionReponse, index) => {
      const {aggregation, groupBy} = queries[index];
      const field = `${aggregation}(${yAxis})`;

      const totalSessions = getTotalsFromSessionsResponse({
        response: sessionReponse,
        field,
      });

      const chartData = fillChartDataFromSessionsResponse(
        yAxis === 'session.duration'
          ? {
              response: sessionReponse,
              field,
              groupBy,
              chartData: initSessionsBreakdownChartData(),
            }
          : {
              response: sessionReponse,
              field,
              groupBy,
              chartData: initSessionDurationChartData(),
              valueFormatter: duration => roundDuration(duration ? duration / 1000 : 0),
            }
      );

      return {
        chartSummary: totalSessions.toLocaleString(),
        chartData: [...Object.values(chartData)],
      };
    });

    setData(newData);
  }

  return children({
    isLoading: !data,
    errored,
    data: data ?? [],
  });
}

export default StatsRequest;
