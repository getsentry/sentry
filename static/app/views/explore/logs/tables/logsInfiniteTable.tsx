import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {Virtualizer} from '@tanstack/react-virtual';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {FileSize} from 'sentry/components/fileSize';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {JumpButtons} from 'sentry/components/replays/jumpButtons';
import {useJumpButtons} from 'sentry/components/replays/useJumpButtons';
import {GridResizer} from 'sentry/components/tables/gridEditable/styles';
import {IconArrow, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {TagCollection} from 'sentry/types/group';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {defined} from 'sentry/utils/defined';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useElementOffset} from 'sentry/utils/useElementOffset';
import {
  TableBodyCell,
  TableHead,
  TableHeadCellContent,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {logsTimestampDescendingSortBy} from 'sentry/views/explore/contexts/logs/sortBys';
import {
  MINIMUM_INFINITE_SCROLL_FETCH_COOLDOWN_MS,
  QUANTIZE_MINUTES,
} from 'sentry/views/explore/logs/constants';
import {getDisplayTotalPayloadBytes} from 'sentry/views/explore/logs/getDisplayTotalPayloadBytes';
import {PinnedLogs} from 'sentry/views/explore/logs/pinning/PinnedLogs';
import {useLogsPinning} from 'sentry/views/explore/logs/pinning/useLogsPinning';
import {usePinnedLogsQuery} from 'sentry/views/explore/logs/pinning/usePinnedLogsQuery';
import {
  FirstTableHeadCell,
  FloatingBackToTopContainer,
  FloatingBottomContainer,
  HoveringRowLoadingCell,
  HoveringRowLoadingRendererContainer,
  HoveringRowLoadingRow,
  LOGS_GRID_BODY_ROW_HEIGHT,
  LogTable,
  LogTableBody,
  LogTableHeadCell,
  LogTableRow,
} from 'sentry/views/explore/logs/styles';
import {calculateLogsTableMinWidth} from 'sentry/views/explore/logs/tables/calculateLogsTableMinWidth';
import {LogsEmptyResults} from 'sentry/views/explore/logs/tables/logsEmptyResults';
import {LogRowContent} from 'sentry/views/explore/logs/tables/logsTableRow';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {
  createPseudoLogResponseItem,
  getDynamicLogsNextFetchThreshold,
  getLogBodySearchTerms,
  getLogRowTimestampMillis,
  getTableHeaderLabel,
  isRegularLogResponseItem,
  logsFieldAlignment,
  quantizeTimestampToMinutes,
  type LogTableRowItem,
} from 'sentry/views/explore/logs/utils';
import type {ReplayEmbeddedTableOptions} from 'sentry/views/explore/logs/utils/logsReplayUtils';
import {
  useQueryParamsFields,
  useQueryParamsSearch,
  useQueryParamsSortBys,
  useSetQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {EmptyStateText} from 'sentry/views/explore/tables/tracesTable/styles';

type LogsTableProps = {
  analyticsPageSource: LogsAnalyticsPageSource;
  additionalData?: {
    event?: Event;
    scrollToDisabled?: boolean;
  };
  allowPagination?: boolean;
  booleanAttributes?: TagCollection;
  embedded?: boolean;
  embeddedOptions?: {
    openWithExpandedIds?: string[];
    replay?: ReplayEmbeddedTableOptions;
  };
  embeddedStyling?: {
    disableBodyPadding?: boolean;
    showVerticalScrollbar?: boolean;
  };
  emptyRenderer?: () => React.ReactNode;
  localOnlyItemFilters?: {
    filterText: string;
    filteredItems: OurLogsResponseItem[];
  };
  numberAttributes?: TagCollection;
  showCellActions?: boolean;
  showExploreSimilarSpansLink?: boolean;
  stringAttributes?: TagCollection;
};

const {info, fmt} = Sentry.logger;

const LOGS_GRID_SCROLL_PIXEL_REVERSE_THRESHOLD = LOGS_GRID_BODY_ROW_HEIGHT * 2; // If you are less than this number of pixels from the top of the table while scrolling backward, fetch the previous page.

export function LogsInfiniteTable({
  embedded = false,
  localOnlyItemFilters,
  emptyRenderer,
  analyticsPageSource,
  numberAttributes,
  stringAttributes,
  booleanAttributes,
  embeddedStyling,
  embeddedOptions,
  additionalData,
  showCellActions,
  showExploreSimilarSpansLink,
}: LogsTableProps) {
  const fields = useQueryParamsFields();
  const search = useQueryParamsSearch();
  const autoRefresh = useLogsAutoRefreshEnabled();
  const lastFetchTime = useRef<number | null>(null);
  const {
    isPending,
    isEmpty,
    meta,
    data: originalData,
    isError,
    fetchNextPage,
    fetchPreviousPage,
    seekToTimestamp,
    isSeekSettled,
    isFetchingNextPage,
    isFetchingPreviousPage,
    lastPageLength,
    isRefetching,
    bytesScanned,
    canResumeAutoFetch,
    resumeAutoFetch,
    totalPayloadBytes,
  } = useLogsPageDataQueryResult();

  const baseData = localOnlyItemFilters?.filteredItems ?? originalData;
  const baseDataLength = useBox(baseData.length);

  const pseudoRowIndex = useMemo(() => {
    if (
      !additionalData?.event ||
      !baseData ||
      baseData.length === 0 ||
      isPending ||
      isError
    ) {
      return -1;
    }
    const event = additionalData.event;
    const eventTimestamp = new Date(event.dateCreated || new Date()).getTime();
    const index = baseData.findIndex(
      row =>
        isRegularLogResponseItem(row) && getLogRowTimestampMillis(row) < eventTimestamp
    );
    return index === -1 ? -2 : index; // If the event is older than all the data, add it to the end with a sentinel value of -2. This causes the useEffect to not continously add it.
  }, [additionalData, baseData, isPending, isError]);

  const data = useMemo(() => {
    if (
      !additionalData?.event ||
      !baseData ||
      baseData.length === 0 ||
      isPending ||
      isError ||
      pseudoRowIndex === -1
    ) {
      return baseData || [];
    }

    const newData: LogTableRowItem[] = [...baseData];
    const newSelectedIndex =
      pseudoRowIndex === -2 ? baseDataLength.current : pseudoRowIndex;
    newData.splice(
      newSelectedIndex,
      0,
      createPseudoLogResponseItem(
        additionalData.event,
        additionalData.event.projectID || ''
      )
    );
    return newData;
  }, [baseData, additionalData, isPending, isError, pseudoRowIndex, baseDataLength]);

  // Calculate quantized start and end times for replay links
  const {logStart, logEnd} = useMemo(() => {
    if (!baseData || baseData.length === 0) {
      return {logStart: undefined, logEnd: undefined};
    }

    const timestamps = baseData.map(row => getLogRowTimestampMillis(row)).filter(Boolean);
    if (timestamps.length === 0) {
      return {logStart: undefined, logEnd: undefined};
    }

    const firstTimestamp = Math.min(...timestamps);
    const lastTimestamp = Math.max(...timestamps);

    const quantizedStart = quantizeTimestampToMinutes(firstTimestamp, QUANTIZE_MINUTES);
    const quantizedEnd = quantizeTimestampToMinutes(
      lastTimestamp + QUANTIZE_MINUTES * 60 * 1000,
      QUANTIZE_MINUTES
    );

    return {
      logStart: new Date(quantizedStart).toISOString(),
      logEnd: new Date(quantizedEnd).toISOString(),
    };
  }, [baseData]);

  const tableRef = useRef<HTMLTableElement>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const {width: tableWidth} = useDimensions({elementRef: tableRef});
  const {top: backToTopOffset} = useElementOffset(tableBodyRef, tableRef);
  const [expandedLogRows, setExpandedLogRows] = useState(
    new Set(embeddedOptions?.openWithExpandedIds)
  );
  const [expandedLogRowsHeights, setExpandedLogRowsHeights] = useState<
    Record<string, number>
  >({});
  const [isFunctionScrolling, setIsFunctionScrolling] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const scrollFetchDisabled = isFunctionScrolling || autorefreshEnabled;

  const sharedHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(
    fields.slice(),
    tableRef,
    {
      minimumColumnWidth: 50,
      prefixColumnWidth: 'min-content',
      staticColumnWidths: {
        [OurLogKnownFieldKey.MESSAGE]: 'minmax(90px,1fr)',
      },
    }
  );

  const estimateSize = useCallback(
    (index: number) => {
      const logItemId = data?.[index]?.[OurLogKnownFieldKey.ID];
      const estimatedHeight =
        expandedLogRowsHeights[logItemId ?? ''] ?? LOGS_GRID_BODY_ROW_HEIGHT;
      return estimatedHeight;
    },
    [expandedLogRowsHeights, data]
  );

  const searchString = search.formatString();
  const highlightTerms = useMemo(() => {
    const terms = getLogBodySearchTerms(search);
    if (localOnlyItemFilters?.filterText) {
      terms.push(localOnlyItemFilters.filterText);
    }
    return terms;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchString, localOnlyItemFilters?.filterText]);

  const virtualizer = useVirtualizer<HTMLElement, Element>({
    count: data?.length ?? 0,
    estimateSize,
    overscan: 35,
    getScrollElement: () => tableBodyRef?.current,
    getItemKey: (index: number) => data?.[index]?.[OurLogKnownFieldKey.ID] ?? index,
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  const firstItem = virtualItems[0]?.start;
  const firstItemIndex = virtualItems[0]?.index;
  const lastItem = virtualItems[virtualItems.length - 1]?.end;
  const lastItemIndex = virtualItems[virtualItems.length - 1]?.index;

  const handleScrollToRow = useCallback(
    (index: number) => {
      virtualizer.scrollToIndex(index, {
        behavior: 'smooth',
        align: 'center',
      });
    },
    [virtualizer]
  );

  useEffect(() => {
    if (
      pseudoRowIndex !== -1 &&
      tableBodyRef?.current &&
      !additionalData?.scrollToDisabled
    ) {
      setTimeout(() => {
        const scrollToIndex =
          pseudoRowIndex === -2 ? baseDataLength.current : pseudoRowIndex;
        virtualizer.scrollToIndex(scrollToIndex, {
          behavior: 'smooth',
          align: 'center',
        });
      }, 100);
    }
  }, [
    pseudoRowIndex,
    virtualizer,
    tableBodyRef,
    baseDataLength,
    additionalData?.scrollToDisabled,
  ]);

  const hasReplay = !!embeddedOptions?.replay;

  const replayJumpButtons = useJumpButtons({
    currentTime: embeddedOptions?.replay?.currentTime ?? 0,
    frames: embeddedOptions?.replay?.frames ?? [],
    isTable: true,
    setScrollToRow: handleScrollToRow,
  });

  const {
    handleClick: onClickToJump,
    onRowsRendered,
    showJumpDownButton,
    showJumpUpButton,
  } = replayJumpButtons;

  const [paddingTop, paddingBottom] =
    defined(firstItem) && defined(lastItem)
      ? [
          Math.max(0, firstItem - virtualizer.options.scrollMargin),
          Math.max(0, virtualizer.getTotalSize() - lastItem),
        ]
      : [0, 0];

  const {scrollDirection, scrollOffset, isScrolling} = virtualizer;

  useEffect(() => {
    if (isFunctionScrolling && !isScrolling && scrollOffset === 0) {
      setTimeout(() => {
        setIsFunctionScrolling(false);
      }, 10);
    }
  }, [isFunctionScrolling, isScrolling, scrollOffset]);

  useEffect(() => {
    if (isScrolling && !scrollFetchDisabled) {
      if (
        scrollDirection === 'backward' &&
        scrollOffset &&
        scrollOffset <= LOGS_GRID_SCROLL_PIXEL_REVERSE_THRESHOLD &&
        !hasReplay // Disable scroll up reload for replay context
      ) {
        fetchPreviousPage();
      }
      if (
        scrollDirection === 'forward' &&
        lastItemIndex &&
        lastItemIndex >= data?.length - getDynamicLogsNextFetchThreshold(lastPageLength)
      ) {
        if (
          lastFetchTime.current === null ||
          Date.now() - lastFetchTime.current > MINIMUM_INFINITE_SCROLL_FETCH_COOLDOWN_MS
        ) {
          fetchNextPage();
          lastFetchTime.current = Date.now();
        }
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
    scrollFetchDisabled,
    lastFetchTime,
    hasReplay,
  ]);

  useEffect(() => {
    if (hasReplay) {
      onRowsRendered({
        startIndex: firstItemIndex ?? 0,
        stopIndex: lastItemIndex ?? 0,
      });
    }
  }, [hasReplay, firstItemIndex, lastItemIndex, onRowsRendered]);

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
    setExpandedLogRowsHeights(prev => {
      const next = {...prev};
      delete next[logItemId];
      return next;
    });
  }, []);

  const tableStaticCSS = useMemo(() => {
    return {
      '.log-table-row-chevron-button': {
        width: '24px',
        height: '24px',
        padding: '4px 6px',
        marginRight: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    };
  }, []);

  const logsPinning = useLogsPinning();
  const pinnedLogsQuery = usePinnedLogsQuery({allRows: data, logsPinning});

  const handleTogglePinnedRow = useCallback(
    (id: string) => {
      if (logsPinning?.hasPinnedRow(id)) {
        setHoveredRowId(null);
      }
      logsPinning?.togglePinnedRow(id);
    },
    [logsPinning]
  );

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    data?.forEach((row, index) => {
      map.set(row[OurLogKnownFieldKey.ID], index);
    });
    return map;
  }, [data]);

  const {requestSeekScroll, isAwaitingSeekWindow} = useScrollToSeekTarget({
    isSeekSettled,
    rowIndexById,
    virtualizer,
    setHoveredRowId,
  });

  const renderRow = useCallback(
    (dataRow: OurLogsResponseItem) => {
      const rowId = dataRow[OurLogKnownFieldKey.ID];
      const pinnedExpandKey = `pinned-${rowId}`;
      const indexInList = rowIndexById.get(rowId);
      return (
        <LogRowContent
          dataRow={dataRow}
          meta={meta}
          highlightTerms={highlightTerms}
          embedded={false}
          sharedHoverTimeoutRef={sharedHoverTimeoutRef}
          expansionKey={pinnedExpandKey}
          onExpand={handleExpand}
          onCollapse={handleCollapse}
          isExpanded={expandedLogRows.has(pinnedExpandKey)}
          onExpandHeight={handleExpandHeight}
          logStart={logStart}
          logEnd={logEnd}
          isPinned={logsPinning?.hasPinnedRow?.(rowId)}
          isHoverLinked={hoveredRowId === rowId}
          setHoveredRowId={setHoveredRowId}
          togglePinnedRow={logsPinning ? handleTogglePinnedRow : undefined}
          onViewInTable={() => {
            if (indexInList !== undefined) {
              handleScrollToRow(indexInList);
              return;
            }
            const timestampPrecise = dataRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE];
            if (timestampPrecise && seekToTimestamp(timestampPrecise)) {
              requestSeekScroll(rowId);
            }
          }}
        />
      );
    },
    [
      expandedLogRows,
      handleCollapse,
      handleExpand,
      handleExpandHeight,
      handleScrollToRow,
      handleTogglePinnedRow,
      highlightTerms,
      hoveredRowId,
      logEnd,
      logStart,
      logsPinning,
      meta,
      requestSeekScroll,
      rowIndexById,
      seekToTimestamp,
    ]
  );

  // For replay context, render empty states outside the table for proper centering
  if (hasReplay && (isPending || isError || isEmpty)) {
    return (
      <Fragment>
        <Flex justify="center" align="center" height="100%" minHeight="200px">
          {isPending && <LoadingRenderer />}
          {isError && <ErrorRenderer />}
          {isEmpty &&
            (emptyRenderer ? (
              emptyRenderer()
            ) : (
              <LogsEmptyResults analyticsPageSource={analyticsPageSource} />
            ))}
        </Flex>
      </Fragment>
    );
  }

  if (originalData.length < 20 && originalData.length > 0 && !isPending && !isError) {
    if (virtualItems.length !== originalData.length) {
      info(
        fmt`Mismatch in virtualItems.length and data.length: virtualItems.length: ${virtualItems.length}, data.length: ${originalData.length}`
      );
    }
  }

  return (
    <Fragment>
      <LogTable
        ref={tableRef}
        style={initialTableStyles}
        css={tableStaticCSS}
        height="100%"
        hideBorder={embedded}
        data-test-id="logs-table"
        minWidth={calculateLogsTableMinWidth(fields.length)}
        showVerticalScrollbar={embeddedStyling?.showVerticalScrollbar}
      >
        {embedded ? null : (
          <LogsTableHeader
            isFrozen={embedded}
            numberAttributes={numberAttributes}
            stringAttributes={stringAttributes}
            booleanAttributes={booleanAttributes}
            onResizeMouseDown={onResizeMouseDown}
          />
        )}
        {/* Keep the pinned section mounted through a seek's refetch — its rows come
            from a separate query we still have, so there's no reason to hide it while
            the main table reloads. */}
        {logsPinning && (!isPending || isAwaitingSeekWindow) && (
          <PinnedLogs
            allRows={data}
            logsPinning={logsPinning}
            pinnedLogsQuery={pinnedLogsQuery}
            renderRow={renderRow}
          />
        )}
        <LogTableBody
          showHeader={!embedded}
          ref={tableBodyRef}
          disableBodyPadding={embeddedStyling?.disableBodyPadding}
        >
          {!isAwaitingSeekWindow && paddingTop > 0 && (
            <TableRow>
              {fields.map(field => (
                <TableBodyCell key={field} style={{height: paddingTop}} />
              ))}
            </TableRow>
          )}
          {/* Only render these in table for non-replay contexts */}
          {/* While a seek's centered window is still loading, keep showing the loader
              so the target is revealed already centered instead of flashing at top. */}
          {!hasReplay && (isPending || isAwaitingSeekWindow) && (
            <LoadingRenderer
              bytesScanned={isAwaitingSeekWindow ? undefined : bytesScanned}
              totalPayloadBytes={isAwaitingSeekWindow ? undefined : totalPayloadBytes}
            />
          )}
          {!hasReplay && isError && <ErrorRenderer />}
          {!hasReplay &&
            isEmpty &&
            (emptyRenderer ? (
              emptyRenderer()
            ) : (
              <LogsEmptyResults
                analyticsPageSource={analyticsPageSource}
                bytesScanned={bytesScanned}
                totalPayloadBytes={totalPayloadBytes}
                canResumeAutoFetch={canResumeAutoFetch}
                resumeAutoFetch={resumeAutoFetch}
              />
            ))}
          {!autoRefresh &&
            !isPending &&
            !isAwaitingSeekWindow &&
            isFetchingPreviousPage && (
              <HoveringRowLoadingRenderer position="top" isEmbedded={embedded} />
            )}
          {isRefetching && !hasReplay && !isAwaitingSeekWindow && (
            <HoveringRowLoadingRenderer position="top" isEmbedded={embedded} />
          )}
          {!isAwaitingSeekWindow &&
            virtualItems.map(virtualRow => {
              const dataRow = data?.[virtualRow.index];

              if (!dataRow) {
                return null;
              }

              const rowId = dataRow[OurLogKnownFieldKey.ID];

              return (
                <Fragment key={virtualRow.key}>
                  <LogRowContent
                    dataRow={dataRow}
                    meta={meta}
                    highlightTerms={highlightTerms}
                    embedded={embedded}
                    embeddedOptions={embeddedOptions}
                    sharedHoverTimeoutRef={sharedHoverTimeoutRef}
                    expansionKey={rowId}
                    key={virtualRow.key}
                    onExpand={handleExpand}
                    onCollapse={handleCollapse}
                    logStart={logStart}
                    logEnd={logEnd}
                    isExpanded={expandedLogRows.has(rowId)}
                    onExpandHeight={handleExpandHeight}
                    showCellActions={showCellActions}
                    showExploreSimilarSpansLink={showExploreSimilarSpansLink}
                    isPinned={logsPinning?.hasPinnedRow?.(rowId)}
                    isHoverLinked={hoveredRowId === rowId}
                    setHoveredRowId={setHoveredRowId}
                    togglePinnedRow={logsPinning ? handleTogglePinnedRow : undefined}
                  />
                </Fragment>
              );
            })}
          {!isAwaitingSeekWindow && paddingBottom > 0 && (
            <TableRow>
              {fields.map(field => (
                <TableBodyCell key={field} style={{height: paddingBottom}} />
              ))}
            </TableRow>
          )}
          {!autoRefresh && !isPending && !isAwaitingSeekWindow && isFetchingNextPage && (
            <HoveringRowLoadingRenderer position="bottom" isEmbedded={embedded} />
          )}
        </LogTableBody>
      </LogTable>
      <FloatingBackToTopContainer
        position="absolute"
        inReplay={!!embeddedOptions?.replay}
        tableWidth={tableWidth}
        topOffset={backToTopOffset}
      >
        {!embeddedOptions?.replay && (
          <BackToTopButton
            virtualizer={virtualizer}
            hidden={
              isPending || ((firstItemIndex ?? 0) === 0 && (scrollOffset ?? 0) < 550)
            }
            setIsFunctionScrolling={setIsFunctionScrolling}
          />
        )}
        {embeddedOptions?.replay && showJumpUpButton ? (
          <JumpButtons jump="up" onClick={onClickToJump} tableHeaderHeight={0} />
        ) : null}
      </FloatingBackToTopContainer>
      <FloatingBottomContainer tableWidth={tableWidth}>
        {embeddedOptions?.replay && showJumpDownButton ? (
          <JumpButtons jump="down" onClick={onClickToJump} tableHeaderHeight={0} />
        ) : null}
      </FloatingBottomContainer>
    </Fragment>
  );
}

function LogsTableHeader({
  isFrozen,
  booleanAttributes,
  numberAttributes,
  stringAttributes,
  onResizeMouseDown,
}: Pick<LogsTableProps, 'numberAttributes' | 'stringAttributes' | 'booleanAttributes'> & {
  isFrozen: boolean;
  onResizeMouseDown: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
}) {
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const setSortBys = useSetQueryParamsSortBys();

  const {data, meta, isError, isPending} = useLogsPageDataQueryResult();
  const pinningEnabled = !!useLogsPinning();
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
            numberAttributes,
            booleanAttributes
          );

          if (isPending) {
            return (
              <LogTableHeadCell
                key={index}
                isFirst={index === 0}
                reservePinGutter={pinningEnabled && index === fields.length - 1}
              />
            );
          }
          return (
            <LogTableHeadCell
              align={index === 0 ? 'left' : align}
              key={index}
              isFirst={index === 0}
              reservePinGutter={pinningEnabled && index === fields.length - 1}
            >
              <TableHeadCellContent
                onClick={
                  isFrozen
                    ? undefined
                    : () => {
                        switch (direction) {
                          case 'asc':
                            setSortBys([logsTimestampDescendingSortBy]);
                            break;
                          case 'desc':
                            setSortBys([{field, kind: 'asc'}]);
                            break;
                          default:
                            setSortBys([{field, kind: 'desc'}]);
                        }
                      }
                }
                isFrozen={isFrozen}
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
            </LogTableHeadCell>
          );
        })}
      </LogTableRow>
    </TableHead>
  );
}

function ErrorRenderer() {
  return (
    <TableStatus>
      <IconWarning variant="muted" size="lg" />
    </TableStatus>
  );
}

export function LoadingRenderer({
  bytesScanned,
  totalPayloadBytes,
}: {
  bytesScanned?: number;
  totalPayloadBytes?: number;
}) {
  const displayTotalPayloadBytes = getDisplayTotalPayloadBytes(
    bytesScanned,
    totalPayloadBytes
  );

  return (
    <TableStatus>
      <Stack align="center">
        <EmptyStateText size="md" textAlign="center">
          <StyledLoadingIndicator margin="1em auto" />
          {defined(bytesScanned) && bytesScanned > 0 && (
            <Fragment>
              {t('Searching for a needle in a haystack. This could take a while.')}
              <br />
              <span>
                {displayTotalPayloadBytes
                  ? tct('[bytesScanned] of ~[totalBytes] scanned', {
                      bytesScanned: <FileSize bytes={bytesScanned} base={2} />,
                      totalBytes: <FileSize bytes={displayTotalPayloadBytes} base={2} />,
                    })
                  : tct('[bytesScanned] scanned', {
                      bytesScanned: <FileSize bytes={bytesScanned} base={2} />,
                    })}
              </span>
            </Fragment>
          )}
        </EmptyStateText>
      </Stack>
    </TableStatus>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)<{
  margin: CSSProperties['margin'];
}>`
  ${p => p.margin && `margin: ${p.margin}`};
`;

function HoveringRowLoadingRenderer({
  position,
  isEmbedded,
}: {
  isEmbedded: boolean;
  position: 'top' | 'bottom';
}) {
  return (
    <HoveringRowLoadingRow>
      <HoveringRowLoadingCell>
        <HoveringRowLoadingRendererContainer
          position={position}
          headerHeight={isEmbedded ? 0 : 45}
          height={
            isEmbedded ? LOGS_GRID_BODY_ROW_HEIGHT * 1 : LOGS_GRID_BODY_ROW_HEIGHT * 3
          }
        >
          <LoadingIndicator
            size={
              isEmbedded
                ? LOGS_GRID_BODY_ROW_HEIGHT * 0.8
                : LOGS_GRID_BODY_ROW_HEIGHT * 1.5
            }
          />
        </HoveringRowLoadingRendererContainer>
      </HoveringRowLoadingCell>
    </HoveringRowLoadingRow>
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

function useBox<T>(value: T): RefObject<T> {
  const box = useRef(value);
  box.current = value;
  return box;
}

const SEEK_HIGHLIGHT_DURATION_MS = 2500;
// Re-assert the scroll across a few frames so it lands once the virtualizer has
// measured the freshly re-anchored window (and any dynamic row heights).
const SEEK_SCROLL_FRAMES = 8;

/**
 * Drives the "View in table" centering for a pinned row outside the loaded window.
 * Call the returned `requestSeekScroll(rowId)` alongside re-anchoring the query. Once
 * the query reports the window is ready (`isSeekSettled` — older and newer rows around
 * the target loaded) this centers the target and briefly highlights it. If the row
 * never appears (e.g. many logs share its timestamp), nothing happens until the seek
 * is superseded.
 */
function useScrollToSeekTarget({
  isSeekSettled,
  rowIndexById,
  virtualizer,
  setHoveredRowId,
}: {
  isSeekSettled: boolean;
  rowIndexById: Map<string, number>;
  setHoveredRowId: Dispatch<SetStateAction<string | null>>;
  virtualizer: Virtualizer<HTMLElement, Element>;
}) {
  const [pendingSeekRowId, setPendingSeekRowId] = useState<string | null>(null);
  const rafRef = useRef(0);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  // Layout effect so the scroll lands before paint — the target is in place on the
  // first frame the centered window renders, rather than visibly jumping.
  useLayoutEffect(() => {
    if (!pendingSeekRowId || !isSeekSettled) {
      return;
    }
    const id = pendingSeekRowId;
    const index = rowIndexById.get(id);
    if (index === undefined) {
      // Window is ready but the target hasn't been merged into the loaded data yet;
      // wait for the next data update rather than giving up.
      return;
    }
    // Consume the request now so re-renders (highlight, further data) don't re-run.
    setPendingSeekRowId(null);

    // These rAFs are intentionally not cancelled on re-render (only on unmount) so a
    // highlight/data re-render can't abort an in-progress scroll.
    let framesRemaining = SEEK_SCROLL_FRAMES;
    const scrollToTarget = () => {
      // The virtualizer positions rows from an estimated height, so for a target far
      // below many off-screen (unmeasured) rows, `scrollToIndex` lands close but below
      // center. Once the row is actually rendered, finish centering from its real DOM
      // position, which doesn't depend on the estimate.
      const scrollEl = virtualizer.scrollElement;
      const rowEl = scrollEl?.querySelector(`[data-log-row-id="${CSS.escape(id)}"]`);
      if (scrollEl && rowEl) {
        const containerRect = scrollEl.getBoundingClientRect();
        const rowRect = rowEl.getBoundingClientRect();
        const delta =
          rowRect.top +
          rowRect.height / 2 -
          (containerRect.top + containerRect.height / 2);
        scrollEl.scrollTop += delta;
      } else {
        virtualizer.scrollToIndex(index, {align: 'center'});
      }
      framesRemaining -= 1;
      if (framesRemaining > 0) {
        rafRef.current = requestAnimationFrame(scrollToTarget);
      }
    };
    scrollToTarget();

    setHoveredRowId(id);
    clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(
      () => setHoveredRowId(current => (current === id ? null : current)),
      SEEK_HIGHLIGHT_DURATION_MS
    );
  }, [pendingSeekRowId, isSeekSettled, rowIndexById, virtualizer, setHoveredRowId]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(highlightTimeoutRef.current);
    },
    []
  );

  return {
    requestSeekScroll: setPendingSeekRowId,
    // A seek is requested but its centered window isn't ready yet. The table shows a
    // loading state until this clears so the target is revealed already centered,
    // rather than flashing at the top of the half-loaded window first.
    isAwaitingSeekWindow: pendingSeekRowId !== null && !isSeekSettled,
  };
}
