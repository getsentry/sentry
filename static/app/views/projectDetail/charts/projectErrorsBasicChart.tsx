import {Fragment, useEffect, useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import type {BarSeriesOption} from 'echarts';

import BaseChart from 'sentry/components/charts/baseChart';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import LoadingError from 'sentry/components/loadingError';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export const ERRORS_BASIC_CHART_PERIODS = ['1h', '24h', '7d', '14d', '30d'];

type Props = {
  onTotalValuesChange: (value: number | null) => void;
  projectId?: string;
};

function ProjectErrorsBasicChart({projectId, onTotalValuesChange}: Props) {
  const organization = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlStatsPeriod = searchParams.get('statsPeriod') ?? '';
  const statsPeriod = ERRORS_BASIC_CHART_PERIODS.includes(urlStatsPeriod)
    ? urlStatsPeriod
    : DEFAULT_STATS_PERIOD;

  const {
    data: projects,
    isLoading,
    isError,
    isSuccess,
  } = useApiQuery<Project[]>(
    [
      `/organizations/${organization.slug}/projects/`,
      {
        query: {
          statsPeriod,
          query: `id:${projectId}`,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: defined(projectId),
    }
  );
  const stats = useMemo(() => {
    return projects?.[0]?.stats ?? [];
  }, [projects]);
  const totalValues = stats.reduce((acc, [, value]) => acc + value, 0);

  useEffect(() => {
    if (!ERRORS_BASIC_CHART_PERIODS.includes(urlStatsPeriod)) {
      setSearchParams(oldParams => {
        oldParams.set('statsPeriod', DEFAULT_STATS_PERIOD);
        oldParams.delete('start');
        oldParams.delete('end');
        return oldParams;
      });
    }
  }, [setSearchParams, urlStatsPeriod]);

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
        colors={theme => [theme.purple300, theme.purple200]}
        grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
      />
    </Fragment>
  );
}

export default ProjectErrorsBasicChart;
