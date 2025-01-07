import {Fragment, useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {LineSeriesOption} from 'echarts';

import LineSeries from 'sentry/components/charts/series/lineSeries';
import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {SessionApiResponse} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {useApiQuery} from 'sentry/utils/queryClient';
import {filterSessionsInTimeWindow, getSessionsInterval} from 'sentry/utils/sessions';

import {DisplayModes} from '../projectCharts';

import type {ProjectSessionsChartRequestProps} from './projectSessionsChartRequest';

const BAD_BEHAVIOUR_THRESHOLD = 0.47;

function ProjectSessionsAnrRequest({
  children,
  organization,
  disablePrevious,
  selection,
  displayMode,
  query,
  onTotalValuesChange,
}: Omit<ProjectSessionsChartRequestProps, 'theme'>) {
  const {datetime, projects, environments: environment} = selection;
  const theme = useTheme();
  const yAxis =
    displayMode === DisplayModes.ANR_RATE ? 'anr_rate()' : 'foreground_anr_rate()';

  const [timeseriesData, setTimeseriesData] = useState<Series[] | null>(null);
  const [badBehaviourSeries, setBadBehaviourSeries] = useState<LineSeriesOption[] | null>(
    null
  );
  const [previousTimeseriesData, setPreviousTimeseriesData] = useState<Series | null>(
    null
  );
  const [totalSessions, setTotalSessions] = useState<number | null>(null);

  const shouldFetchWithPrevious =
    !disablePrevious &&
    shouldFetchPreviousPeriod({
      start: datetime.start,
      end: datetime.end,
      period: datetime.period,
    });

  function getParams(): Record<string, any> {
    const baseParams = {
      field: [yAxis, 'count_unique(user)'],
      interval: getSessionsInterval(datetime, {
        highFidelity: organization.features.includes('minute-resolution-sessions'),
        dailyInterval: true,
      }),
      project: projects[0],
      environment,
      query,
    };

    if (!shouldFetchWithPrevious) {
      return {
        ...baseParams,
        ...normalizeDateTimeParams(datetime),
      };
    }

    const {period} = selection.datetime;
    const doubledPeriod = getPeriod(
      {period, start: undefined, end: undefined},
      {shouldDoublePeriod: true}
    ).statsPeriod;

    return {
      ...baseParams,
      statsPeriod: doubledPeriod,
    };
  }

  const queryParams = getParams();

  const {data, isRefetching, isError} = useApiQuery<SessionApiResponse>(
    [`/organizations/${organization.slug}/sessions/`, {query: queryParams}],
    {
      staleTime: 0,
    }
  );

  useEffect(() => {
    if (defined(data)) {
      const filteredResponse = filterSessionsInTimeWindow(
        data,
        queryParams.start,
        queryParams.end
      );

      const dataMiddleIndex = Math.floor(filteredResponse.intervals.length / 2);

      const totalUsers = filteredResponse.groups.reduce(
        (acc, group) =>
          acc +
          group.series['count_unique(user)']!.slice(
            shouldFetchWithPrevious ? dataMiddleIndex : 0
          ).reduce((value, groupAcc) => groupAcc + value, 0),
        0
      );

      setTotalSessions(totalUsers);
      onTotalValuesChange(totalUsers);

      const previousPeriodTotalUsers = filteredResponse
        ? filteredResponse.groups.reduce(
            (acc, group) =>
              acc +
              group.series['count_unique(user)']!.slice(0, dataMiddleIndex).reduce(
                (value, groupAcc) => groupAcc + value,
                0
              ),
            0
          )
        : 0;

      const timeseriesData_ = [
        {
          seriesName: t('This Period'),
          data: filteredResponse.intervals
            .slice(shouldFetchWithPrevious ? dataMiddleIndex : 0)
            .map((interval, i) => {
              const anrRate = filteredResponse.groups.reduce(
                (acc, group) =>
                  acc +
                  group.series[yAxis]?.slice(
                    shouldFetchWithPrevious ? dataMiddleIndex : 0
                  )[i]!,
                0
              );

              return {
                name: interval,
                value:
                  totalUsers === 0 && previousPeriodTotalUsers === 0
                    ? 0
                    : anrRate === null
                      ? null
                      : anrRate * 100,
              };
            }),
        },
      ] as Series[];

      const badBehaviourSeries_ =
        yAxis === 'foreground_anr_rate()'
          ? [
              LineSeries({
                name: t('Overall Bad Behaviour Threshold'),
                data: filteredResponse.intervals
                  .slice(shouldFetchWithPrevious ? dataMiddleIndex : 0)
                  .map(interval => [interval, BAD_BEHAVIOUR_THRESHOLD]),
                lineStyle: {color: theme.red200, width: 2, type: 'dotted'},
                itemStyle: {color: theme.red200},
                animation: false,
                stack: 'bad_behaviour_threshold',
              }),
            ]
          : null;

      const previousTimeseriesData_ = shouldFetchWithPrevious
        ? ({
            seriesName: t('Previous Period'),
            data: filteredResponse.intervals
              .slice(0, dataMiddleIndex)
              .map((_interval, i) => {
                const previousAnrRate = filteredResponse.groups.reduce(
                  (acc, group) =>
                    acc + group.series[yAxis]?.slice(0, dataMiddleIndex)[i]!,
                  0
                );

                return {
                  name: filteredResponse.intervals[i + dataMiddleIndex],
                  value:
                    totalUsers === 0 && previousPeriodTotalUsers === 0
                      ? 0
                      : previousAnrRate === null
                        ? null
                        : previousAnrRate * 100,
                };
              }),
          } as Series) // TODO(project-detail): Change SeriesDataUnit value to support null
        : null;

      setTimeseriesData(timeseriesData_);
      setPreviousTimeseriesData(previousTimeseriesData_);
      setBadBehaviourSeries(badBehaviourSeries_);
    }
  }, [
    data,
    onTotalValuesChange,
    queryParams.end,
    queryParams.start,
    shouldFetchWithPrevious,
    theme.red200,
    yAxis,
  ]);

  return (
    <Fragment>
      {children({
        loading: timeseriesData === null,
        reloading: isRefetching,
        errored: isError,
        totalSessions,
        previousTimeseriesData,
        timeseriesData: timeseriesData ?? [],
        additionalSeries: badBehaviourSeries ?? undefined,
      })}
    </Fragment>
  );
}

export default ProjectSessionsAnrRequest;
