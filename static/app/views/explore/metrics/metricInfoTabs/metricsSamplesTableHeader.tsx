import type {ReactNode} from 'react';

import {Tooltip} from 'sentry/components/core/tooltip';
import {IconFire, IconSpan, IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import {NoPaddingColumns} from 'sentry/views/explore/metrics/constants';
import {
  NumericSimpleTableHeaderCell,
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

const ICON_HEADERS = {
  [VirtualTableSampleColumnKey.LOGS]: <IconTerminal color="gray400" />,
  [VirtualTableSampleColumnKey.SPANS]: <IconSpan color="purple400" />,
  [VirtualTableSampleColumnKey.ERRORS]: <IconFire color="red300" />,
};

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
        const columnType = getMetricTableColumnType(field);
        const label = getFieldLabel(field);

        return (
          <FieldHeaderCellWrapper
            key={i}
            field={field}
            index={i}
            sort={sorts.find(s => s.field === field)?.kind}
            embedded={embedded}
          >
            {columnType === 'stat'
              ? ICON_HEADERS[field as keyof typeof ICON_HEADERS]
              : null}
            {columnType === 'metric_value' ? label : null}
            {columnType === 'value' ? label : null}
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
  const hasPadding = !NoPaddingColumns.includes(field as VirtualTableSampleColumnKey);

  if (columnType === 'stat') {
    return (
      <NumericSimpleTableHeaderCell
        key={`stat-${index}`}
        divider={false}
        data-column-name={field}
        embedded={embedded}
      >
        <Tooltip title={label} skipWrapper>
          {children}
        </Tooltip>
      </NumericSimpleTableHeaderCell>
    );
  }

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
    [TraceMetricKnownFieldKey.TRACE]: () => t('Trace'),
    [TraceMetricKnownFieldKey.METRIC_VALUE]: () => t('Value'),
    [TraceMetricKnownFieldKey.TIMESTAMP]: () => t('Timestamp'),
    [TraceMetricKnownFieldKey.METRIC_NAME]: () => t('Metric'),
    [VirtualTableSampleColumnKey.LOGS]: () => t('Logs'),
    [VirtualTableSampleColumnKey.SPANS]: () => t('Spans'),
    [VirtualTableSampleColumnKey.ERRORS]: () => t('Errors'),
  };
  return fieldLabels[field]?.() ?? null;
}
