import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import {GridRow} from 'sentry/components/tables/gridEditable/styles';
import {IconChevron, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {TableBody} from 'sentry/views/explore/components/table';
import type {LogsPinning} from 'sentry/views/explore/logs/pinning/useLogsPinning';
import type {usePinnedLogsQuery} from 'sentry/views/explore/logs/pinning/usePinnedLogsQuery';
import {LOGS_GRID_BODY_ROW_HEIGHT} from 'sentry/views/explore/logs/styles';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {LogTableRowItem} from 'sentry/views/explore/logs/utils';

interface Props {
  allRows: LogTableRowItem[];
  logsPinning: LogsPinning;
  pinnedLogsQuery: ReturnType<typeof usePinnedLogsQuery>;
  renderRow: (dataRow: LogTableRowItem) => React.ReactNode;
}

export function PinnedLogs({allRows, logsPinning, pinnedLogsQuery, renderRow}: Props) {
  const {fetchedRows: fetchedPinnedRows, isPending: isFetchingPinnedRows} =
    pinnedLogsQuery;
  const [expanded, setExpanded] = useState(true);
  const pinnedRows = logsPinning.getPinnedRowIds();

  const onInitialize = useCallback(() => {
    setExpanded(true);
  }, []);

  const rowById = useMemo(() => {
    const map = new Map<string, LogTableRowItem>();
    for (const row of fetchedPinnedRows) {
      map.set(row[OurLogKnownFieldKey.ID], row);
    }
    for (const row of allRows) {
      map.set(row[OurLogKnownFieldKey.ID], row);
    }
    return map;
  }, [allRows, fetchedPinnedRows]);

  if (!pinnedRows.length) {
    return null;
  }

  return (
    <PinnedTableBody data-test-id="pinned-logs-table-body" ref={onInitialize}>
      {expanded &&
        pinnedRows.map(rowId => {
          const dataRow = rowById.get(rowId);

          if (!dataRow) {
            if (isFetchingPinnedRows) {
              return (
                <GridRow key={rowId}>
                  <LoadingGridBodyCell>
                    <Placeholder height="100%" />
                  </LoadingGridBodyCell>
                </GridRow>
              );
            }
            return null;
          }

          return <Fragment key={rowId}>{renderRow(dataRow)}</Fragment>;
        })}
      <GridRow role="toolbar">
        <PinnedGridBodyCell>
          <Flex justify="end">
            <Button
              size="xs"
              icon={<IconChevron size="xs" direction={expanded ? 'up' : 'down'} />}
              onClick={() => setExpanded(previous => !previous)}
            >
              {expanded
                ? t('Collapse %s pinned', pinnedRows.length)
                : t('Expand %s pinned', pinnedRows.length)}
            </Button>
            <Button
              aria-label={t('Clear all pins')}
              icon={<IconClose size="xs" />}
              onClick={logsPinning.clearPinnedRows}
              size="xs"
              variant="transparent"
            >
              {t('Clear all')}
            </Button>
          </Flex>
        </PinnedGridBodyCell>
      </GridRow>
    </PinnedTableBody>
  );
}

const PinnedTableBody = styled(TableBody)`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  height: max-content;
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
`;

const PinnedGridBodyCell = styled('td')`
  grid-column: 1 / -1;
  padding: ${p => p.theme.space.sm};
`;

const LoadingGridBodyCell = styled(PinnedGridBodyCell)`
  height: ${LOGS_GRID_BODY_ROW_HEIGHT}px;
`;
