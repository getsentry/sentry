import {Fragment, useEffect, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {BarSeriesOption} from 'echarts';
import {useQueryStates} from 'nuqs';

import {BaseChart} from 'sentry/components/charts/baseChart';
import {LoadingPanel} from 'sentry/components/charts/loadingPanel';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {LoadingError} from 'sentry/components/loadingError';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Project, ProjectStats} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {useOrganization} from 'sentry/utils/useOrganization';

export const ERRORS_BASIC_CHART_PERIODS = ['1h', '24h', '7d', '14d', '30d'];
type ProjectErrorsResponse = Project & {stats?: ProjectStats};

const periodParsers = {
  statsPeriod: pageFilterParsers.statsPeriod,
  start: pageFilterParsers.start,
  end: pageFilterParsers.end,
};

type Props = {
  onTotalValuesChange: (value: number | null) => void;
  projectId?: string;
};

export function ProjectErrorsBasicChart({projectId, onTotalValuesChange}: Props) {
  const organization = useOrganization();
  const [{statsPeriod: urlStatsPeriod}, setPeriodParams] = useQueryStates(periodParsers);

  const statsPeriod = ERRORS_BASIC_CHART_PERIODS.includes(urlStatsPeriod)
    ? urlStatsPeriod
    : DEFAULT_STATS_PERIOD;

  const {
    data: projects,
    isLoading,
    isError,
    isSuccess,
  } = useQuery({
    ...apiOptions.as<ProjectErrorsResponse[]>()(
      '/organizations/$organizationIdOrSlug/projects/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          statsPeriod,
          query: `id:${projectId}`,
        },
        staleTime: 0,
      }
    ),
    enabled: defined(projectId),
  });
  const stats = useMemo(() => {
    return projects?.[0]?.stats ?? [];
  }, [projects]);
  const totalValues = stats.reduce((acc, [, value]) => acc + value, 0);

  useEffect(() => {
    if (!ERRORS_BASIC_CHART_PERIODS.includes(urlStatsPeriod)) {
      setPeriodParams(
        {statsPeriod: DEFAULT_STATS_PERIOD, start: null, end: null},
        {history: 'push'}
      );
    }
  }, [setPeriodParams, urlStatsPeriod]);

  useEffect(() => {
    if (isSuccess) {
      onTotalValuesChange(totalValues);
    }
  }, [isSuccess, onTotalValuesChange, totalValues]);

  if (isLoading) {
    return <LoadingPanel height="200px" data-test-id="events-request-loading" />;
  }

  if (isError) {
    return <LoadingError />;
  }

  const series: BarSeriesOption[] = [
    {
      cursor: 'normal' as const,
      name: t('Errors'),
      type: 'bar',
      data: stats.map(([timestamp, value]) => [timestamp * 1000, value]) ?? [],
    },
  ];

  return (
    <Fragment>
      <HeaderTitleLegend>{t('Daily Errors')}</HeaderTitleLegend>
      <BaseChart
        series={series}
        isGroupedByDate
        showTimeInTooltip
        colors={theme => [
          theme.tokens.dataviz.semantic.accent,
          theme.tokens.dataviz.semantic.neutral,
        ]}
        grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
      />
    </Fragment>
  );
}
