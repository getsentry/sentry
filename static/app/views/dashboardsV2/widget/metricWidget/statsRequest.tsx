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
} from 'app/views/releases/detail/overview/chart/utils';
import {roundDuration} from 'app/views/releases/utils';

import {MetricQuery} from './types';
import {getBreakdownChartData} from './utils';

type RequestQuery = {
  field: string;
  interval: string;
  query?: string;
  start?: string;
  end?: string;
  period?: string;
  utc?: string;
};

type ChildrenArgs = {
  isLoading: boolean;
  errored: boolean;
  series: Series[];
};

type Props = {
  api: Client;
  organization: Organization;
  projectSlug: Project['slug'];
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
  projectSlug,
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
  }, [projectSlug, environments, datetime, queries, yAxis]);

  function fetchData() {
    if (!yAxis) {
      return;
    }

    const queriesWithAggregation = queries.filter(({aggregation}) => !!aggregation);

    if (!queriesWithAggregation.length) {
      return;
    }

    setIsLoading(true);

    const requestExtraParams = getParams(
      pick(
        location.query,
        Object.values(URL_PARAM).filter(param => param !== URL_PARAM.PROJECT)
      )
    );

    const promises = queriesWithAggregation.map(({aggregation, groupBy, tags}) => {
      const query: RequestQuery = {
        field: `${aggregation}(${yAxis})`,
        interval: getInterval(datetime),
        ...requestExtraParams,
      };

      if (tags) {
        const tagsWithDoubleQuotes = tags
          .split(' ')
          .filter(tag => !!tag)
          .map(tag => {
            const [key, value] = tag.split(':');

            if (key && value) {
              return `${key}:"${value}"`;
            }

            return '';
          })
          .filter(tag => !!tag);

        if (!!tagsWithDoubleQuotes.length) {
          query.query = stringifyQueryObject(new QueryResults(tagsWithDoubleQuotes));
        }
      }

      const metricDataEndpoint = `/projects/${organization.slug}/${projectSlug}/metrics/data/`;

      if (!!groupBy.length) {
        const groupByParameter = [...groupBy].join('&groupBy=');
        return api.requestPromise(`${metricDataEndpoint}?groupBy=${groupByParameter}`, {
          query,
        });
      }

      return api.requestPromise(metricDataEndpoint, {
        query,
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
      setIsLoading(false);
      return;
    }

    const seriesData = sessionReponses.map((sessionResponse, index) => {
      const {aggregation, groupBy, legend} = queries[index];
      const field = `${aggregation}(${yAxis})`;

      const breakDownChartData = getBreakdownChartData({
        response: sessionResponse,
        legend: !!legend ? legend : `Query ${index + 1}`,
        groupBy: !!groupBy.length ? groupBy[0] : undefined,
      });

      const chartData = fillChartDataFromSessionsResponse({
        response: sessionResponse,
        field,
        groupBy: !!groupBy.length ? groupBy[0] : null,
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
