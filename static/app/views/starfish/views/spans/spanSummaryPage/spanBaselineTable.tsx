import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader as Column,
} from 'sentry/components/gridEditable';
import {Series} from 'sentry/types/echarts';
import {formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import {DURATION_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Sparkline, {
  generateHorizontalLine,
} from 'sentry/views/starfish/components/sparkline';
import {SpanDescription} from 'sentry/views/starfish/views/spans/spanSummaryPanel/spanDescription';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';
import {useApplicationMetrics} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useApplicationMetrics';
import {useSpanMetrics} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanMetrics';
import {useSpanMetricSeries} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanMetricSeries';

type Props = {
  span: Span;
};

type Metric = {
  p50: number;
  spm: number;
};

type Row = {
  app_impact: string;
  description: string;
  metricSeries: Record<string, Series>;
  metrics: Metric;
};

export function SpanBaselineTable({span}: Props) {
  const location = useLocation();

  const {data: applicationMetrics} = useApplicationMetrics();
  const {data: spanMetrics} = useSpanMetrics(span);
  const {data: spanMetricSeries} = useSpanMetricSeries(span);

  const renderHeadCell = column => {
    return <span>{column.name}</span>;
  };

  const renderBodyCell = (column, row: Row) => {
    return <BodyCell span={span} column={column} row={row} />;
  };

  return (
    <GridEditable
      isLoading={false}
      data={[
        {
          description: span.description ?? '',
          metrics: spanMetrics,
          metricSeries: spanMetricSeries,
          app_impact: formatPercentage(
            spanMetrics.total_time / applicationMetrics.total_time
          ),
        },
      ]}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
      location={location}
    />
  );
}

type CellProps = {column: Column; row: Row; span: Span};

function BodyCell({span, column, row}: CellProps) {
  if (column.key === 'description') {
    return <DescriptionCell span={span} row={row} column={column} />;
  }

  if (column.key === 'p50(span.self_time)') {
    return <P50Cell span={span} row={row} column={column} />;
  }

  if (column.key === 'epm()') {
    return <EPMCell span={span} row={row} column={column} />;
  }

  return <span>{row[column.key]}</span>;
}

function DescriptionCell({span}: CellProps) {
  return <SpanDescription span={span} />;
}

function P50Cell({row}: CellProps) {
  const theme = useTheme();
  const p50 = row.metrics?.p50;
  const p50Series = row.metricSeries?.p50;

  return (
    <Fragment>
      {p50Series ? (
        <Sparkline
          color={DURATION_COLOR}
          series={p50Series}
          markLine={
            p50 ? generateHorizontalLine(`${p50.toFixed(2)}`, p50, theme) : undefined
          }
        />
      ) : null}
    </Fragment>
  );
}

function EPMCell({row}: CellProps) {
  const theme = useTheme();
  const epm = row.metrics?.spm;
  const epmSeries = row.metricSeries?.spm;

  return (
    <Fragment>
      {epmSeries ? (
        <Sparkline
          color={THROUGHPUT_COLOR}
          series={epmSeries}
          markLine={
            epm ? generateHorizontalLine(`${epm.toFixed(2)}`, epm, theme) : undefined
          }
        />
      ) : null}
    </Fragment>
  );
}

const COLUMN_ORDER = [
  {
    key: 'description',
    name: 'Description',
    width: 500,
  },
  {
    key: 'epm()',
    name: 'Throughput (TPM)',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p50(span.self_time)',
    name: 'Duration (P50)',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'app_impact',
    name: 'App Impact',
    width: COL_WIDTH_UNDEFINED,
  },
];
