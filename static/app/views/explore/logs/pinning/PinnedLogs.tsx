import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {GridRow} from 'sentry/components/tables/gridEditable/styles';
import {IconChevron, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {TableBody} from 'sentry/views/explore/components/table';
import {useLogsPinning} from 'sentry/views/explore/logs/pinning/useLogsPinning';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {LogTableRowItem} from 'sentry/views/explore/logs/utils';

interface Props {
  allRows: LogTableRowItem[];
  renderRow: (dataRow: LogTableRowItem) => React.ReactNode;
}

export function PinnedLogs({allRows, renderRow}: Props) {
  const logsPinning = useLogsPinning();
  const [expanded, setExpanded] = useState(true);
  const pinsCount = logsPinning?.pinnedRows.size;

  useEffect(() => {
    if (!pinsCount) {
      setExpanded(true);
    }
  }, [pinsCount]);

  if (!logsPinning || !pinsCount) {
    return null;
  }

  return (
    <PinnedTableBody>
      {expanded &&
        Array.from(logsPinning.pinnedRows).map(rowId => {
          const dataRow = allRows.find(datum => datum[OurLogKnownFieldKey.ID] === rowId);

          // TODO(LOGS-781): this is not correct yet because the virtualizer might not have found it yet.
          // Will have to manually re-fetch data.
          if (!dataRow) {
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
                ? t('Collapse %s pinned', pinsCount)
                : t('Expand %s pinned', pinsCount)}
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
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
`;

const PinnedGridBodyCell = styled('td')`
  grid-column: 1 / -1;
  padding: ${p => p.theme.space.sm};
`;
