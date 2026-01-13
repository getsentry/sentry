import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import BaseChart from 'sentry/components/charts/baseChart';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import NoEvents from './noEvents';

type BaseChartProps = React.ComponentProps<typeof BaseChart>;

type Props = {
  firstEvent: boolean;
  project: Project;
  stats: Project['stats'];
  onBarClick?: (data: {seriesName: string; timestamp: number; value: number}) => void;
  transactionStats?: Project['transactionStats'];
};

export function ProjectChart({
  firstEvent,
  stats,
  transactionStats,
  onBarClick,
  project,
}: Props) {
  const series: BaseChartProps['series'] = [];
  const hasTransactions = transactionStats !== undefined;
  const navigate = useNavigate();
  const organization = useOrganization();

  const theme = useTheme();

  if (transactionStats) {
    const transactionSeries = transactionStats.map(([timestamp, value]) => ({
      value: [timestamp * 1000, value],
      onClick: onBarClick
        ? () =>
            onBarClick({
              timestamp,
              value,
              seriesName: 'Transactions',
            })
        : undefined,
    }));

    series.push({
      cursor: 'normal' as const,
      name: t('Transactions'),
      type: 'bar',
      data: transactionSeries,
      barMinHeight: 1,
      xAxisIndex: 1,
      yAxisIndex: 1,
      itemStyle: {
        color: theme.tokens.dataviz.semantic.neutral,
        opacity: 0.8,
      },
      emphasis: {
        itemStyle: {
          color: theme.tokens.dataviz.semantic.neutral,
          opacity: 1.0,
        },
      },
    });
  }

  if (stats) {
    series.push({
      cursor: 'pointer' as const,
      name: t('Errors'),
      type: 'bar',
      data: stats.map(([timestamp, value]) => ({
        value: [timestamp * 1000, value],
        onClick: () =>
          navigate(constructErrorsLink(organization, project, timestamp * 1000)),
      })),
      barMinHeight: 1,
      xAxisIndex: 0,
      yAxisIndex: 0,
      itemStyle: {
        color: theme.tokens.dataviz.semantic.accent,
        opacity: 0.6,
      },
      emphasis: {
        itemStyle: {
          color: theme.tokens.dataviz.semantic.accent,
          opacity: 0.8,
        },
      },
    });
  }
  const grid = hasTransactions
    ? [
        {
          top: 10,
          bottom: 60,
          left: 2,
          right: 2,
        },
        {
          top: 105,
          bottom: 0,
          left: 2,
          right: 2,
        },
      ]
    : [
        {
          top: 10,
          bottom: 0,
          left: 2,
          right: 2,
        },
      ];

  const chartOptions = {
    series,
    colors: [],
    height: 150,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    grid,
    tooltip: {
      trigger: 'axis' as const,
    },
    xAxes: Array.from(new Array(series.length)).map((_i, index) => ({
      gridIndex: index,
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        show: false,
      },
      axisPointer: {
        type: 'line' as const,
        label: {
          show: false,
        },
        lineStyle: {
          width: 0,
        },
      },
    })),
    yAxes: Array.from(new Array(series.length)).map((_i, index) => ({
      gridIndex: index,
      interval: Infinity,
      max(value: {max: number}) {
        // This keeps small datasets from looking 'scary'
        // by having full bars for < 10 values.
        return Math.max(10, value.max);
      },
      axisLabel: {
        margin: 2,
        showMaxLabel: true,
        showMinLabel: false,
        color: theme.tokens.content.muted,
        fontFamily: theme.text.family,
        inside: true,
        lineHeight: 12,
        formatter: (value: number) => axisLabelFormatter(value, 'number', true),
        textBorderColor: theme.backgroundSecondary,
        textBorderWidth: 1,
      },
      splitLine: {
        show: false,
      },
      zlevel: theme.zIndex.header,
    })),
    axisPointer: {
      // Link each x-axis together.
      link: [{xAxisIndex: [0, 1]}],
    },
    options: {
      animation: false,
    },
  };

  return (
    <Fragment>
      <BaseChart {...chartOptions} />
      {!firstEvent && <NoEvents seriesCount={series.length} />}
    </Fragment>
  );
}

const constructErrorsLink = (
  organization: Organization,
  project: Project,
  timestamp: number
) => {
  const start = new Date(timestamp);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return normalizeUrl(
    `/organizations/${organization.slug}/issues/?project=${project.id}&start=${start.toISOString()}&end=${end.toISOString()}`
  );
};
