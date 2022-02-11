import {useEffect, useState} from 'react';
import * as React from 'react';
import {Location} from 'history';
import pick from 'lodash/pick';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {
  MetricQuery,
  Organization,
  PageFilters,
  Project,
  SessionApiResponse,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {SessionMetric} from 'sentry/utils/metrics/fields';
import {getSessionsInterval} from 'sentry/utils/sessions';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {roundDuration} from 'sentry/views/releases/utils';

import {fillChartDataFromMetricsResponse, getBreakdownChartData} from './utils';

type FilteredGrouping = Required<Pick<MetricQuery, 'metricMeta' | 'aggregation'>> &
  Omit<MetricQuery, 'metricMeta' | 'aggregation'>;

type RequestQuery = {
  field: string;
  interval: string;
  end?: string;
  period?: string | null;
  query?: string;
  start?: string;
  utc?: string;
};

type ChildrenArgs = {
  errored: boolean;
  isLoading: boolean;
  series: Series[];
};

type Props = {
  api: Client;
  children: (args: ChildrenArgs) => React.ReactElement;
  datetime: PageFilters['datetime'];
  environments: PageFilters['environments'];
  groupings: MetricQuery[];
  location: Location;
  organization: Organization;
  projectId: Project['id'];
  searchQuery?: string;
};

function StatsRequest({
  api,
  organization,
  projectId,
  groupings,
  environments,
  datetime,
  location,
  children,
  searchQuery,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [series, setSeries] = useState<Series[]>([]);

  const filteredGroupings = groupings.filter(
    ({aggregation, metricMeta}) => !!metricMeta?.name && !!aggregation
  ) as FilteredGrouping[];

  useEffect(() => {
    fetchData();
  }, [projectId, environments, datetime, groupings, searchQuery]);

  function fetchData() {
    if (!filteredGroupings.length) {
      return;
    }

    setErrored(false);
    setIsLoading(true);

    const requestExtraParams = normalizeDateTimeParams(
      pick(
        location.query,
        Object.values(URL_PARAM).filter(param => param !== URL_PARAM.PROJECT)
      )
    );

    const promises = filteredGroupings.map(({metricMeta, aggregation, groupBy}) => {
      const query: RequestQuery = {
        field: `${aggregation}(${metricMeta.name})`,
        interval: getSessionsInterval(datetime),
        ...requestExtraParams,
      };

      if (searchQuery) {
        const tagsWithDoubleQuotes = searchQuery
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
          query.query = new MutableSearch(tagsWithDoubleQuotes).formatString();
        }
      }

      const metricDataEndpoint = `/organizations/${organization.slug}/metrics/data/?project=${projectId}`;

      if (!!groupBy?.length) {
        const groupByParameter = [...groupBy].join('&groupBy=');
        return api.requestPromise(`${metricDataEndpoint}&groupBy=${groupByParameter}`, {
          query,
        });
      }

      // TODO(metrics): replace with doMetricsRequest
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
    if (!sessionReponses.length) {
      setIsLoading(false);
      return;
    }

    const seriesData = sessionReponses.map((sessionResponse, index) => {
      const {aggregation, legend, metricMeta} = filteredGroupings[index];
      const field = `${aggregation}(${metricMeta.name})`;

      const breakDownChartData = getBreakdownChartData({
        response: sessionResponse,
        sessionResponseIndex: index + 1,
        legend,
      });

      const chartData = fillChartDataFromMetricsResponse({
        response: sessionResponse,
        field,
        chartData: breakDownChartData,
        valueFormatter:
          metricMeta.name === SessionMetric.SENTRY_SESSIONS_SESSION_DURATION
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
