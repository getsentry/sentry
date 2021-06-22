import {useEffect, useState} from 'react';
import * as React from 'react';
import {Location} from 'history';
import pick from 'lodash/pick';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import {GlobalSelection, Organization, Project, SessionApiResponse} from 'app/types';
import {Series} from 'app/types/echarts';
import {QueryResults} from 'app/utils/tokenizeSearch';
import {getInterval} from 'app/views/releases/detail/overview/chart/utils';
import {roundDuration} from 'app/views/releases/utils';

import {MetricQuery} from './types';
import {fillChartDataFromMetricsResponse, getBreakdownChartData} from './utils';

type FilteredGrouping = Required<Pick<MetricQuery, 'metricMeta' | 'aggregation'>> &
  Omit<MetricQuery, 'metricMeta' | 'aggregation'>;

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
  environments: GlobalSelection['environments'];
  datetime: GlobalSelection['datetime'];
  location: Location;
  children: (args: ChildrenArgs) => React.ReactElement;
  groupings: MetricQuery[];
  searchQuery?: string;
};

function StatsRequest({
  api,
  organization,
  projectSlug,
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
  }, [projectSlug, environments, datetime, groupings, searchQuery]);

  function fetchData() {
    if (!filteredGroupings.length) {
      return;
    }

    setErrored(false);
    setIsLoading(true);

    const requestExtraParams = getParams(
      pick(
        location.query,
        Object.values(URL_PARAM).filter(param => param !== URL_PARAM.PROJECT)
      )
    );

    const promises = filteredGroupings.map(({metricMeta, aggregation, groupBy}) => {
      const query: RequestQuery = {
        field: `${aggregation}(${metricMeta.name})`,
        interval: getInterval(datetime),
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
          query.query = new QueryResults(tagsWithDoubleQuotes).formatString();
        }
      }

      const metricDataEndpoint = `/projects/${organization.slug}/${projectSlug}/metrics/data/`;

      if (!!groupBy?.length) {
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
          metricMeta.name === 'session.duration'
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
