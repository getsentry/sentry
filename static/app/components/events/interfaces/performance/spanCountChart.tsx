import {useState} from 'react';

import {BarChart} from 'sentry/components/charts/barChart';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DateString, TagValue} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import SpanCountHistogramQuery from 'sentry/utils/performance/histogram/spanCountHistogramQuery';
import {HistogramData} from 'sentry/utils/performance/histogram/types';
import {formatHistogramData} from 'sentry/utils/performance/histogram/utils';
import theme from 'sentry/utils/theme';

export function SpanCountChart({issue, event, location, organization}: any) {
  const transactionNameTag = event.tags.find(tag => tag.key === 'transaction');
  const transactionName = transactionNameTag ? transactionNameTag.value : '';

  const spanHashTag = event.tags.find(
    (tag: TagValue) => tag.key === 'performance_issue.extra_spans'
  ) || {key: '', value: ''};

  const allEventsQuery = `event.type:transaction transaction:${transactionName}`;
  const affectedEventsQuery = `${allEventsQuery} ${spanHashTag.key}:${spanHashTag.value}`;

  const [now] = useState<DateString>(new Date());

  const start = issue.firstSeen;
  const end = now?.toString();
  const environment = [];
  const project = [1];
  const spanOp = event.contexts.performance_issue.op;

  function renderChart(data: HistogramData) {
    const xAxis = {
      type: 'category' as const,
      truncate: true,
      axisTick: {
        interval: 5,
        alignWithLabel: true,
      },
    };

    const colors = theme.charts.getColorPalette(4);
    const tooltip = {
      formatter(series) {
        const seriesData = Array.isArray(series) ? series : [series];
        let contents: string[] = [];

        contents = seriesData.map(item => {
          const label = item.seriesName;
          const value = item.value[1].toLocaleString();
          return [
            '<div class="tooltip-series">',
            `<div><span class="tooltip-label">${item.marker} <strong>${label}</strong></span> ${value}</div>`,
            '</div>',
          ].join('');
        });
        const seriesLabel = seriesData[0].value[0];
        contents.push(`<div class="tooltip-date">${seriesLabel}</div>`);

        contents.push('<div class="tooltip-arrow"></div>');
        return contents.join('');
      },
    };

    const series = {
      seriesName: t('Transaction Count'),
      data: formatHistogramData(data, {type: 'number'}),
    };

    return (
      <BarChart
        grid={{left: '0', right: '0', top: '0', bottom: '0'}}
        xAxis={xAxis}
        yAxis={{type: 'value', show: false, axisLabel: {formatter: _ => ''}}}
        series={[series]}
        tooltip={tooltip}
        colors={colors}
        height={200}
      />
    );
  }

  const affectedEventsEventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: '',
      fields: ['transaction.duration'],
      projects: project,
      query: affectedEventsQuery,
      environment,
      start,
      end,
    },
    location
  );

  return (
    <SpanCountHistogramQuery
      location={location}
      orgSlug={organization.slug}
      eventView={affectedEventsEventView}
      numBuckets={50}
      spanOp={spanOp}
      dataFilter="exclude_outliers"
    >
      {({histogram, isLoading, error}) => {
        if (isLoading) {
          return <LoadingPanel data-test-id="histogram-loading" />;
        }

        if (error) {
          return (
            <ErrorPanel>
              <IconWarning color="gray300" size="lg" />
            </ErrorPanel>
          );
        }

        return renderChart(histogram || []);
      }}
    </SpanCountHistogramQuery>
  );
}
