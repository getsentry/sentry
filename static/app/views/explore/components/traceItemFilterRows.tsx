import {Fragment, memo} from 'react';

import {Text} from '@sentry/scraps/text';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {t} from 'sentry/locale';
import {getFilterRows} from 'sentry/views/explore/components/traceItemFilterQuery';

function TraceItemFilterRowsComponent({
  onClearFilter,
  onDeleteFilter,
  orderStart,
  pendingRows,
  rowIds,
  summary,
  targetAction,
}: {
  orderStart: number;
  pendingRows: number;
  rowIds: readonly string[];
  summary: string;
  targetAction: string | ((filter: string, index: number, rowId: string) => string);
  onClearFilter?: (index: number) => void;
  onDeleteFilter?: (index: number) => void;
}) {
  const filters = getFilterRows(summary);
  const rows = [...filters, ...Array.from({length: pendingRows}, () => '')];

  return rows.map((filter, index) => {
    const rowId = rowIds[index];
    if (!rowId) {
      return null;
    }

    return (
      <Fragment key={rowId}>
        <CMDKAction.Target
          id={`trace-item-filter-${rowId}`}
          actionContext={`filter:${rowId}`}
          display={{
            label: t('Filter By'),
            trailingItem: <QueryValue value={filter} />,
          }}
          keywords={['search', 'filter', 'narrow', 'where', 'show', filter]}
          order={orderStart + index}
          target={
            typeof targetAction === 'function'
              ? targetAction(filter, index, rowId)
              : targetAction
          }
        />
        {filter && onClearFilter && (
          <CMDKAction.Callback
            actionPanel={{
              context: `filter:${rowId}`,
              label: t('Clear Filter'),
              placement: 'panel-only',
            }}
            display={{label: t('Clear Filter')}}
            onAction={() => onClearFilter(index)}
          />
        )}
        {rows.length > 1 && onDeleteFilter && (
          <CMDKAction.Callback
            actionPanel={{
              context: `filter:${rowId}`,
              label: t('Delete Filter'),
              placement: 'panel-only',
            }}
            display={{label: t('Delete Filter')}}
            onAction={() => onDeleteFilter(index)}
          />
        )}
      </Fragment>
    );
  });
}

export const TraceItemFilterRows = memo(TraceItemFilterRowsComponent);

function QueryValue({value}: {value: string}) {
  return (
    <Text size="sm" variant={value ? 'accent' : 'muted'} ellipsis>
      {value || t('None')}
    </Text>
  );
}
