import type {ReactNode} from 'react';

import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {
  StyledSimpleTableHeader,
  StyledSimpleTableHeaderCell,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {
  TraceMetricKnownFieldKey,
  VirtualTableSampleColumnKey,
  type SampleTableColumnKey,
} from 'sentry/views/explore/metrics/types';
import {getMetricTableColumnType} from 'sentry/views/explore/metrics/utils';
import {useQueryParamsSortBys} from 'sentry/views/explore/queryParams/context';

interface MetricsSamplesTableHeaderProps {
  columns: SampleTableColumnKey[];
  embedded?: boolean;
}

export function MetricsSamplesTableHeader({
  columns,
  embedded,
}: MetricsSamplesTableHeaderProps) {
  const sorts = useQueryParamsSortBys();

  return (
    <StyledSimpleTableHeader>
      {columns.map((field, i) => {
        const label = getFieldLabel(field);

        return (
          <FieldHeaderCellWrapper
            key={i}
            field={field}
            index={i}
            sort={sorts.find(s => s.field === field)?.kind}
            embedded={embedded}
          >
            {label}
          </FieldHeaderCellWrapper>
        );
      })}
    </StyledSimpleTableHeader>
  );
}

function FieldHeaderCellWrapper({
  field,
  children,
  index,
  sort,
  embedded = false,
}: {
  children: ReactNode;
  field: SampleTableColumnKey;
  index: number;
  embedded?: boolean;
  sort?: 'asc' | 'desc';
}) {
  const columnType = getMetricTableColumnType(field);
  const label = getFieldLabel(field);
  const hasPadding = field !== VirtualTableSampleColumnKey.EXPAND_ROW;

  if (columnType === 'metric_value') {
    return (
      <StyledSimpleTableHeaderCell
        key={index}
        sort={sort}
        style={{
          justifyContent: 'flex-end',
          paddingRight: 'calc(12px + 15px)', // 12px is the padding of the cell, 15px is the width of the scrollbar.
        }}
        embedded={embedded}
      >
        <Tooltip showOnlyOnOverflow title={label}>
          {children}
        </Tooltip>
      </StyledSimpleTableHeaderCell>
    );
  }

  return (
    <StyledSimpleTableHeaderCell
      key={index}
      sort={sort}
      noPadding={!hasPadding}
      embedded={embedded}
    >
      <Tooltip showOnlyOnOverflow title={label}>
        {children}
      </Tooltip>
    </StyledSimpleTableHeaderCell>
  );
}

function getFieldLabel(field: SampleTableColumnKey): ReactNode {
  const fieldLabels: Record<SampleTableColumnKey, () => ReactNode> = {
    [VirtualTableSampleColumnKey.EXPAND_ROW]: () => null,
    [TraceMetricKnownFieldKey.TRACE]: () => t('Trace ID'),
    [TraceMetricKnownFieldKey.METRIC_VALUE]: () => t('Value'),
    [TraceMetricKnownFieldKey.TIMESTAMP]: () => t('Timestamp'),
    [TraceMetricKnownFieldKey.METRIC_NAME]: () => t('Metric'),
    [VirtualTableSampleColumnKey.PROJECT_BADGE]: () => t('Project'),
  };
  return fieldLabels[field]?.() ?? null;
}
