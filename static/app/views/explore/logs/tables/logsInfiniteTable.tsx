import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {Virtualizer} from '@tanstack/react-virtual';
import {useVirtualizer, useWindowVirtualizer} from '@tanstack/react-virtual';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {GridResizer} from 'sentry/components/tables/gridEditable/styles';
import {IconArrow, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {
  Table,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableHeadCellContent,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {useLogsPageData} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsAutoRefresh,
  useLogsFields,
  useLogsIsTableFrozen,
  useLogsSearch,
  useLogsSortBys,
  useSetLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_INSTRUCTIONS_URL} from 'sentry/views/explore/logs/constants';
import {
  FirstTableHeadCell,
  FloatingBackToTopContainer,
  HoveringRowLoadingRendererContainer,
  LOGS_GRID_BODY_ROW_HEIGHT,
  LogTableBody,
  LogTableRow,
} from 'sentry/views/explore/logs/styles';
import {LogRowContent} from 'sentry/views/explore/logs/tables/logsTableRow';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  getDynamicLogsNextFetchThreshold,
  getLogBodySearchTerms,
  getTableHeaderLabel,
  logsFieldAlignment,
} from 'sentry/views/explore/logs/utils';
import {EmptyStateText} from 'sentry/views/traces/styles';

type LogsTableProps = {
  allowPagination?: boolean;
  numberAttributes?: TagCollection;
  scrollContainer?: React.RefObject<HTMLElement | null>;
  showHeader?: boolean;
  stringAttributes?: TagCollection;
};

const LOGS_GRID_SCROLL_PIXEL_REVERSE_THRESHOLD = LOGS_GRID_BODY_ROW_HEIGHT * 2; // If you are less than this number of pixels from the top of the table while scrolling backward, fetch the previous page.
const LOGS_OVERSCAN_AMOUNT = 50; // How many items to render beyond the visible area.

export function LogsInfiniteTable({
  showHeader = true,
  numberAttributes,
  stringAttributes,
  scrollContainer,
}: LogsTableProps) {
  const theme = useTheme();
  const fields = useLogsFields();
  const search = useLogsSearch();
  const isTableFrozen = useLogsIsTableFrozen();
  const autoRefresh = useLogsAutoRefresh();
  const {infiniteLogsQueryResult} = useLogsPageData();
  const {
    isPending,
    isEmpty,
    meta,
    data,
    isError,
    fetchNextPage,
    fetchPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    lastPageLength,
  } = infiniteLogsQueryResult;

  const tableRef = useRef<HTMLTableElement>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const [expandedLogRows, setExpandedLogRows] = useState<Set<string>>(new Set());
  const [expandedLogRowsHeights, setExpandedLogRowsHeights] = useState<
    Record<string, number>
  >({});
  const [isFunctionScrolling, setIsFunctionScrolling] = useState(false);

  const sharedHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(fields, tableRef, {
    minimumColumnWidth: 50,
    prefixColumnWidth: 'min-content',
    staticColumnWidths: {
      [OurLogKnownFieldKey.MESSAGE]: '1fr',
    },
  });

  const estimateSize = useCallback(
    (index: number) => {
      const logItemId = data?.[index]?.[OurLogKnownFieldKey.ID];
      const estimatedHeight =
        expandedLogRowsHeights[logItemId ?? ''] ?? LOGS_GRID_BODY_ROW_HEIGHT;
      return estimatedHeight;
    },
    [expandedLogRowsHeights, data]
  );

  const highlightTerms = useMemo(() => getLogBodySearchTerms(search), [search]);

  const windowVirtualizer = useWindowVirtualizer({
    count: data?.length ?? 0,
    estimateSize,
    overscan: LOGS_OVERSCAN_AMOUNT,
    getItemKey: (index: number) => data?.[index]?.[OurLogKnownFieldKey.ID] ?? index,
    scrollMargin: tableBodyRef.current?.offsetTop ?? 0,
  });

  const containerVirtualizer = useVirtualizer({
    count: data?.length ?? 0,
    estimateSize,
    overscan: LOGS_OVERSCAN_AMOUNT,
    getScrollElement: () => scrollContainer?.current ?? null,
    getItemKey: (index: number) => data?.[index]?.[OurLogKnownFieldKey.ID] ?? index,
  });

  const virtualizer = scrollContainer?.current ? containerVirtualizer : windowVirtualizer;
  const virtualItems = virtualizer.getVirtualItems();

  const firstItem = virtualItems[0]?.start;
  const firstItemIndex = virtualItems[0]?.index;
  const lastItem = virtualItems[virtualItems.length - 1]?.end;
  const lastItemIndex = virtualItems[virtualItems.length - 1]?.index;

  const [paddingTop, paddingBottom] =
    defined(firstItem) && defined(lastItem)
      ? [
          Math.max(0, firstItem - virtualizer.options.scrollMargin),
          Math.max(0, virtualizer.getTotalSize() - lastItem),
        ]
      : [0, 0];

  const {scrollDirection, scrollOffset, isScrolling} = scrollContainer
    ? containerVirtualizer
    : virtualizer;

  useEffect(() => {
    if (isFunctionScrolling && !isScrolling && scrollOffset === 0) {
      setTimeout(() => {
        setIsFunctionScrolling(false);
      }, 10);
    }
  }, [isFunctionScrolling, isScrolling, scrollOffset]);

  useEffect(() => {
    if (isScrolling && !isFunctionScrolling) {
      if (
        scrollDirection === 'backward' &&
        scrollOffset &&
        scrollOffset <= LOGS_GRID_SCROLL_PIXEL_REVERSE_THRESHOLD
      ) {
        fetchPreviousPage();
      }
      if (
        scrollDirection === 'forward' &&
        lastItemIndex &&
        lastItemIndex >= data?.length - getDynamicLogsNextFetchThreshold(lastPageLength)
      ) {
        fetchNextPage();
      }
    }
  }, [
    scrollDirection,
    lastItemIndex,
    data?.length,
    isScrolling,
    fetchNextPage,
    fetchPreviousPage,
    lastPageLength,
    scrollOffset,
    isFunctionScrolling,
  ]);

  const handleExpand = useCallback((logItemId: string) => {
    setExpandedLogRows(prev => {
      const newSet = new Set(prev);
      newSet.add(logItemId);
      return newSet;
    });
  }, []);
  const handleExpandHeight = useCallback((logItemId: string, estimatedHeight: number) => {
    setExpandedLogRowsHeights(prev => ({...prev, [logItemId]: estimatedHeight}));
  }, []);
  const handleCollapse = useCallback((logItemId: string) => {
    setExpandedLogRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(logItemId);
      return newSet;
    });
  }, []);

  const tableStaticCSS = useMemo(() => {
    return {
      '.log-table-row-chevron-button': {
        width: theme.isChonk ? '24px' : '18px',
        height: theme.isChonk ? '24px' : '18px',
        marginRight: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    };
  }, [theme.isChonk]);

  return (
    <Fragment>
      <Table
        ref={tableRef}
        style={initialTableStyles}
        css={tableStaticCSS}
        hideBorder={isTableFrozen}
        data-test-id="logs-table"
      >
        {showHeader ? (
          <LogsTableHeader
            numberAttributes={numberAttributes}
            stringAttributes={stringAttributes}
            onResizeMouseDown={onResizeMouseDown}
          />
        ) : null}
        <LogTableBody showHeader={showHeader} ref={tableBodyRef}>
          {paddingTop > 0 && (
            <TableRow>
              {fields.map(field => (
                <TableBodyCell key={field} style={{height: paddingTop}} />
              ))}
            </TableRow>
          )}
          {isPending && <LoadingRenderer />}
          {isError && <ErrorRenderer />}
          {isEmpty && <EmptyRenderer />}
          {!autoRefresh && !isPending && isFetchingPreviousPage && (
            <HoveringRowLoadingRenderer position="top" />
          )}
          {virtualItems.map(virtualRow => {
            const dataRow = data?.[virtualRow.index];

            if (!dataRow) {
              return null;
            }
            return (
              <Fragment key={virtualRow.key}>
                <LogRowContent
                  dataRow={dataRow}
                  meta={meta}
                  highlightTerms={highlightTerms}
                  sharedHoverTimeoutRef={sharedHoverTimeoutRef}
                  key={virtualRow.key}
                  canDeferRenderElements
                  onExpand={handleExpand}
                  onCollapse={handleCollapse}
                  isExpanded={expandedLogRows.has(dataRow[OurLogKnownFieldKey.ID])}
                  onExpandHeight={handleExpandHeight}
                />
              </Fragment>
            );
          })}
          {paddingBottom > 0 && (
            <TableRow>
              {fields.map(field => (
                <TableBodyCell key={field} style={{height: paddingBottom}} />
              ))}
            </TableRow>
          )}
          {!autoRefresh && !isPending && isFetchingNextPage && (
            <HoveringRowLoadingRenderer position="bottom" />
          )}
        </LogTableBody>
      </Table>
      <FloatingBackToTopContainer
        tableLeft={tableRef.current?.getBoundingClientRect().left ?? 0}
        tableWidth={tableRef.current?.getBoundingClientRect().width ?? 0}
      >
        <BackToTopButton
          virtualizer={virtualizer}
          hidden={isPending || (firstItemIndex ?? 0) === 0}
          setIsFunctionScrolling={setIsFunctionScrolling}
        />
      </FloatingBackToTopContainer>
    </Fragment>
  );
}

function LogsTableHeader({
  numberAttributes,
  stringAttributes,
  onResizeMouseDown,
}: Pick<LogsTableProps, 'numberAttributes' | 'stringAttributes'> & {
  onResizeMouseDown: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
}) {
  const isTableFrozen = useLogsIsTableFrozen();
  const fields = useLogsFields();
  const sortBys = useLogsSortBys();
  const setSortBys = useSetLogsSortBys();

  const {infiniteLogsQueryResult} = useLogsPageData();

  const {data, meta, isError, isPending} = infiniteLogsQueryResult;
  return (
    <TableHead>
      <LogTableRow>
        <FirstTableHeadCell isFirst align="left">
          <TableHeadCellContent isFrozen />
        </FirstTableHeadCell>
        {fields.map((field, index) => {
          const direction = sortBys.find(s => s.field === field)?.kind;

          const fieldType = meta?.fields?.[field];
          const align = logsFieldAlignment(field, fieldType);
          const headerLabel = getTableHeaderLabel(
            field,
            stringAttributes,
            numberAttributes
          );

          if (isPending) {
            return <TableHeadCell key={index} isFirst={index === 0} />;
          }
          return (
            <TableHeadCell
              align={index === 0 ? 'left' : align}
              key={index}
              isFirst={index === 0}
            >
              <TableHeadCellContent
                onClick={isTableFrozen ? undefined : () => setSortBys([{field}])}
                isFrozen={isTableFrozen}
              >
                <Tooltip showOnlyOnOverflow title={headerLabel}>
                  {headerLabel}
                </Tooltip>
                {defined(direction) && (
                  <IconArrow
                    size="xs"
                    direction={
                      direction === 'desc'
                        ? 'down'
                        : direction === 'asc'
                          ? 'up'
                          : undefined
                    }
                  />
                )}
              </TableHeadCellContent>
              {index !== fields.length - 1 && (
                <GridResizer
                  dataRows={!isError && !isPending && data ? data.length : 0}
                  onMouseDown={e => onResizeMouseDown(e, index)}
                />
              )}
            </TableHeadCell>
          );
        })}
      </LogTableRow>
    </TableHead>
  );
}

function EmptyRenderer() {
  return (
    <TableStatus>
      <EmptyStateWarning withIcon>
        <EmptyStateText size="xl">{t('No logs found')}</EmptyStateText>
        <EmptyStateText size="md">
          {tct(
            'Try adjusting your filters or get started with sending logs by checking these [instructions]',
            {
              instructions: (
                <ExternalLink href={LOGS_INSTRUCTIONS_URL}>
                  {t('instructions')}
                </ExternalLink>
              ),
            }
          )}
        </EmptyStateText>
      </EmptyStateWarning>
    </TableStatus>
  );
}

function ErrorRenderer() {
  return (
    <TableStatus>
      <IconWarning color="gray300" size="lg" />
    </TableStatus>
  );
}

function LoadingRenderer({size}: {size?: number}) {
  return (
    <TableStatus size={size}>
      <LoadingIndicator size={size} />
    </TableStatus>
  );
}

function HoveringRowLoadingRenderer({position}: {position: 'top' | 'bottom'}) {
  return (
    <HoveringRowLoadingRendererContainer
      position={position}
      rowHeight={LOGS_GRID_BODY_ROW_HEIGHT}
      headerHeight={45}
    >
      <LoadingIndicator size={LOGS_GRID_BODY_ROW_HEIGHT * 1.5} />
    </HoveringRowLoadingRendererContainer>
  );
}

function BackToTopButton({
  virtualizer,
  hidden,
  setIsFunctionScrolling,
}: {
  hidden: boolean;
  setIsFunctionScrolling: (isScrolling: boolean) => void;
  virtualizer: Virtualizer<HTMLElement, Element> | Virtualizer<Window, Element>;
}) {
  if (hidden) {
    return null;
  }
  return (
    <Button
      onClick={() => {
        setIsFunctionScrolling(true);
        virtualizer.scrollToOffset(0, {
          behavior: 'smooth',
        });
      }}
      aria-label="Back to top"
    >
      <IconArrow direction="up" size="md" />
    </Button>
  );
}
