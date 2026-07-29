/* eslint-disable unicorn/filename-case */
import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {GridRow} from 'sentry/components/tables/gridEditable/styles';
import {IconChevron, IconClose, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {TableBody} from 'sentry/views/explore/components/table';
import type {LogsPinning} from 'sentry/views/explore/logs/pinning/useLogsPinning';
import type {usePinnedLogsQuery} from 'sentry/views/explore/logs/pinning/usePinnedLogsQuery';
import {LOGS_GRID_BODY_ROW_HEIGHT} from 'sentry/views/explore/logs/styles';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {compareLogRowsBySortBys} from 'sentry/views/explore/logs/utils';
import {useQueryParamsSortBys} from 'sentry/views/explore/queryParams/context';

interface Props {
  allRows: OurLogsResponseItem[];
  logsPinning: LogsPinning;
  pinnedLogsQuery: ReturnType<typeof usePinnedLogsQuery>;
  renderRow: (dataRow: OurLogsResponseItem) => React.ReactNode;
}

export function PinnedLogs({allRows, logsPinning, pinnedLogsQuery, renderRow}: Props) {
  const {
    fetchedRows: fetchedPinnedRows,
    statusById: pinnedRowStatusById,
    refetch: refetchPinnedRows,
  } = pinnedLogsQuery;
  const [expanded, setExpanded] = useState(true);
  const sortBys = useQueryParamsSortBys();
  const pinnedRows = logsPinning.getPinnedRowIds();

  const onInitialize = useCallback(() => {
    setExpanded(true);
  }, []);

  const rowById = useMemo(() => {
    const map = new Map<string, OurLogsResponseItem>();
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
        pinnedRows
          .toSorted((aId, bId) => {
            const aRow = rowById.get(aId);
            const bRow = rowById.get(bId);
            if (!aRow || !bRow) {
              return aRow ? -1 : bRow ? 1 : 0;
            }
            return compareLogRowsBySortBys(aRow, bRow, sortBys);
          })
          .map(rowId => {
            const dataRow = rowById.get(rowId);

            if (!dataRow) {
              const status = pinnedRowStatusById.get(rowId) ?? 'pending';

              if (status === 'pending') {
                return (
                  <GridRow key={rowId}>
                    <LoadingGridBodyCell>
                      <Placeholder height="100%" />
                    </LoadingGridBodyCell>
                  </GridRow>
                );
              }

              const isErrorRow = status === 'error';
              return (
                <GridRow key={rowId}>
                  <UnavailableGridBodyCell>
                    <Flex align="center" gap="sm">
                      <IconWarning size="xs" />
                      <Text size="sm" variant="muted">
                        {isErrorRow
                          ? t('Could not load pinned log')
                          : t('Pinned log unavailable in the selected time range')}
                      </Text>
                      {isErrorRow && (
                        <Button size="xs" onClick={() => refetchPinnedRows()}>
                          {t('Retry')}
                        </Button>
                      )}
                    </Flex>
                  </UnavailableGridBodyCell>
                </GridRow>
              );
            }

            return <Fragment key={rowId}>{renderRow(dataRow)}</Fragment>;
          })}
      <PinnedToolbarRow role="toolbar">
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
      </PinnedToolbarRow>
    </PinnedTableBody>
  );
}

const PinnedTableBody = styled(TableBody)`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
`;

const PinnedToolbarRow = styled(GridRow)`
  position: sticky;
  bottom: 0;
  z-index: 1;
  background-color: ${p => p.theme.tokens.background.primary};
`;

const PinnedGridBodyCell = styled('td')`
  grid-column: 1 / -1;
  padding: ${p => p.theme.space.sm};
`;

const LoadingGridBodyCell = styled(PinnedGridBodyCell)`
  height: ${LOGS_GRID_BODY_ROW_HEIGHT}px;
`;

const UnavailableGridBodyCell = styled(PinnedGridBodyCell)`
  display: flex;
  align-items: center;
  height: ${LOGS_GRID_BODY_ROW_HEIGHT}px;
`;
