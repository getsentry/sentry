import type {ReactNode} from 'react';

import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  StyledSimpleTableHeader,
  StyledSimpleTableHeaderCell,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {
  SORTABLE_SAMPLE_COLUMNS,
  TraceMetricKnownFieldKey,
  VirtualTableSampleColumnKey,
  type SampleTableColumnKey,
} from 'sentry/views/explore/metrics/types';
import {getMetricTableColumnType} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsSortBys,
  useSetQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

interface MetricsSamplesTableHeaderProps {
  columns: SampleTableColumnKey[];
  embedded?: boolean;
}

export function MetricsSamplesTableHeader({
  columns,
  embedded,
}: MetricsSamplesTableHeaderProps) {
  const sorts = useQueryParamsSortBys();
  const setSorts = useSetQueryParamsSortBys();

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
            setSorts={setSorts}
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
  setSorts,
  embedded = false,
}: {
  children: ReactNode;
  field: SampleTableColumnKey;
  index: number;
  setSorts: (sorts: Sort[]) => void;
  embedded?: boolean;
  sort?: 'asc' | 'desc';
}) {
  const columnType = getMetricTableColumnType(field);
  const label = getFieldLabel(field);
  const hasPadding = field !== VirtualTableSampleColumnKey.EXPAND_ROW;
  const canSort = SORTABLE_SAMPLE_COLUMNS.has(field);

  function handleSortClick() {
    const kind = sort === 'desc' ? 'asc' : 'desc';
    setSorts([{field, kind}]);
  }

  if (columnType === 'metric_value') {
    return (
      <StyledSimpleTableHeaderCell
        key={index}
        sort={sort}
        handleSortClick={canSort ? handleSortClick : undefined}
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
      handleSortClick={canSort ? handleSortClick : undefined}
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
