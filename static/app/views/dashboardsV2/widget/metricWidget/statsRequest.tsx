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
import {
  fillChartDataFromSessionsResponse,
  getInterval,
} from 'app/views/releases/detail/overview/chart/utils';
import {roundDuration} from 'app/views/releases/utils';

import {MetricQuery} from './types';
import {getBreakdownChartData} from './utils';

type ChildrenArgs = {
  isLoading: boolean;
  errored: boolean;
  series: Series[];
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
  const [isLoading, setIsLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [series, setSeries] = useState<Series[]>([]);

  useEffect(() => {
    fetchData();
  }, [projectId, environments, datetime, queries, yAxis]);

  function fetchData() {
    if (!yAxis) {
      return;
    }

    const queriesWithAggregation = queries.filter(({aggregation}) => !!aggregation);

    if (!queriesWithAggregation.length) {
      return;
    }

    setIsLoading(true);

    const promises = queriesWithAggregation.map(({aggregation, groupBy}) => {
      return api.requestPromise(`/organizations/${organization.slug}/sessions/`, {
        query: {
          project: projectId,
          environment: environments,
          groupBy: groupBy || null,
          field: `${aggregation}(${yAxis})`,
          interval: getInterval(datetime),
          ...getParams(pick(location.query, Object.values(URL_PARAM))),
        },
      });
    });

    Promise.all(promises)
      .then(results => {
        getChartData(results as SessionApiResponse[]);
      })
      .catch(error => {
        addErrorMessage(error.responseJSON?.detail ?? t('Error loading chart data'));
        setErrored(true);
      });
  }

  function getChartData(sessionReponses: SessionApiResponse[]) {
    if (!sessionReponses.length || !yAxis) {
      return;
    }

    const seriesData = sessionReponses.map((sessionReponse, index) => {
      const {aggregation, groupBy} = queries[index];
      const field = `${aggregation}(${yAxis})`;

      const breakDownChartData = getBreakdownChartData({
        response: sessionReponse,
        groupBy: groupBy || null,
      });

      const chartData = fillChartDataFromSessionsResponse({
        response: sessionReponse,
        field,
        groupBy: groupBy || null,
        chartData: breakDownChartData,
        valueFormatter:
          yAxis === 'session.duration'
            ? duration => roundDuration(duration ? duration / 1000 : 0)
            : undefined,
      });

      return [...Object.values(chartData)];
    });

    const newSeries = seriesData.reduce((mergedSeries, chartDataSeries) => {
      return mergedSeries.concat(chartDataSeries);
    }, []);

    setSeries(newSeries);
    setIsLoading(false);
  }

  return children({isLoading, errored, series});
}

export default StatsRequest;
