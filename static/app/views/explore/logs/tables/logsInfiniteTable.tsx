import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
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
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {ColumnType} from 'sentry/utils/discover/fields';
import {FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {isRateLimitError} from 'sentry/utils/requestError/requestError';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useElementOffset} from 'sentry/utils/useElementOffset';
import {useLocation} from 'sentry/utils/useLocation';
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
import {LOGS_ROW_ID_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
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
  HoveringRowLoadingRendererContainer,
  LOGS_GRID_BODY_ROW_HEIGHT,
  LogTable,
  LogTableBody,
  LogTableHeadCell,
  LogTableRow,
} from 'sentry/views/explore/logs/styles';
import {calculateLogsTableMinWidth} from 'sentry/views/explore/logs/tables/calculateLogsTableMinWidth';
import {LogsEmptyResults} from 'sentry/views/explore/logs/tables/logsEmptyResults';
import {LogsRateLimitError} from 'sentry/views/explore/logs/tables/logsRateLimitError';
import {LogRowContent} from 'sentry/views/explore/logs/tables/logsTableRow';
import {useLogsTableColumnWidths} from 'sentry/views/explore/logs/tables/useLogsTableColumnWidths';
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
  validatedFieldTypes?: Partial<Record<string, FieldValueType>>;
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
  validatedFieldTypes = {},
}: LogsTableProps) {
  const location = useLocation();
  const linkedRowId = decodeScalar(location.query[LOGS_ROW_ID_KEY]);
  const fields = useQueryParamsFields();
  const search = useQueryParamsSearch();
  const autoRefresh = useLogsAutoRefreshEnabled();
  const lastFetchTime = useRef<number | null>(null);
  const {
    isPending,
    isEmpty,
    meta: rawMeta,
    data: originalData,
    isError,
    error,
    refetch,
    fetchNextPage,
    fetchPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    lastPageLength,
    isRefetching,
    bytesScanned,
    canResumeAutoFetch,
    resumeAutoFetch,
    totalPayloadBytes,
  } = useLogsPageDataQueryResult();
  const meta = useMemo(
    () =>
      addValidatedFieldTypesToLogsMeta({
        meta: rawMeta,
        validatedFieldTypes,
      }),
    [rawMeta, validatedFieldTypes]
  );

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
    new Set([
      ...(embeddedOptions?.openWithExpandedIds ?? []),
      ...(linkedRowId ? [linkedRowId] : []),
    ])
  );
  const [expandedLogRowsHeights, setExpandedLogRowsHeights] = useState<
    Record<string, number>
  >({});

  // Keep the linked row expanded across client-side navigations that change
  // `logsRowId`. This is additive: we never collapse a previously expanded row
  // since we can't tell a prior link apart from a user-expanded row.
  useEffect(() => {
    if (!linkedRowId) {
      return;
    }
    setExpandedLogRows(prev => {
      if (prev.has(linkedRowId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(linkedRowId);
      return next;
    });
  }, [linkedRowId]);

  const [isFunctionScrolling, setIsFunctionScrolling] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const scrollFetchDisabled = isFunctionScrolling || autorefreshEnabled;

  const sharedHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const getItemKey = useCallback(
    (index: number) => data?.[index]?.[OurLogKnownFieldKey.ID] ?? index,
    [data]
  );

  const virtualizer = useVirtualizer<HTMLElement, Element>({
    count: data?.length ?? 0,
    estimateSize,
    overscan: 35,
    getScrollElement: () => tableBodyRef?.current,
    getItemKey,
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

  const staticColumnWidths = useLogsTableColumnWidths({
    fields,
    tableRef,
    isPending,
    isScrolling,
    dataLength: data?.length ?? 0,
  });

  const {initialTableStyles, onResizeMouseDown} = useTableStyles(
    fields.slice(),
    tableRef,
    {
      minimumColumnWidth: 50,
      prefixColumnWidth: 'min-content',
      staticColumnWidths,
    }
  );

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

  const renderRow = useCallback(
    (dataRow: OurLogsResponseItem) => {
      const rowId = dataRow[OurLogKnownFieldKey.ID];
      const pinnedExpandKey = `pinned-${rowId}`;
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
        />
      );
    },
    [
      expandedLogRows,
      handleCollapse,
      handleExpand,
      handleExpandHeight,
      handleTogglePinnedRow,
      highlightTerms,
      hoveredRowId,
      logEnd,
      logStart,
      logsPinning,
      meta,
    ]
  );

  // For replay context, render empty states outside the table for proper centering
  if (hasReplay && (isPending || isError || isEmpty)) {
    return (
      <Fragment>
        <Flex justify="center" align="center" height="100%" minHeight="200px">
          {isPending && <LoadingRenderer />}
          {isError && <ErrorRenderer error={error} onRetry={refetch} />}
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
            validatedFieldTypes={validatedFieldTypes}
            onResizeMouseDown={onResizeMouseDown}
          />
        )}
        {!isPending && logsPinning && (
          <PinnedLogs
            allRows={data as OurLogsResponseItem[]}
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
          {paddingTop > 0 && (
            <TableRow>
              {fields.map(field => (
                <TableBodyCell key={field} style={{height: paddingTop}} />
              ))}
            </TableRow>
          )}
          {/* Only render these in table for non-replay contexts */}
          {!hasReplay && isPending && (
            <LoadingRenderer
              bytesScanned={bytesScanned}
              totalPayloadBytes={totalPayloadBytes}
            />
          )}
          {!hasReplay && isError && <ErrorRenderer error={error} onRetry={refetch} />}
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
          {!autoRefresh && !isPending && isFetchingPreviousPage && (
            <HoveringRowLoadingRenderer position="top" isEmbedded={embedded} />
          )}
          {isRefetching && !hasReplay && (
            <HoveringRowLoadingRenderer position="top" isEmbedded={embedded} />
          )}
          {virtualItems.map(virtualRow => {
            const dataRow = data?.[virtualRow.index];

            if (!dataRow) {
              return null;
            }

            const rowId = dataRow[OurLogKnownFieldKey.ID];

            return (
              <Fragment key={virtualRow.key}>
                <LogRowContent
                  dataRow={dataRow as OurLogsResponseItem}
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
                  isHighlighted={!!linkedRowId && rowId === linkedRowId}
                  isHoverLinked={hoveredRowId === rowId}
                  setHoveredRowId={setHoveredRowId}
                  togglePinnedRow={logsPinning ? handleTogglePinnedRow : undefined}
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
  validatedFieldTypes = {},
  onResizeMouseDown,
}: Pick<
  LogsTableProps,
  'numberAttributes' | 'stringAttributes' | 'booleanAttributes' | 'validatedFieldTypes'
> & {
  isFrozen: boolean;
  onResizeMouseDown: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
}) {
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const setSortBys = useSetQueryParamsSortBys();

  const {data, meta, isError, isPending} = useLogsPageDataQueryResult();
  const resolvedMeta = useMemo(
    () => addValidatedFieldTypesToLogsMeta({meta, validatedFieldTypes}),
    [meta, validatedFieldTypes]
  );
  const pinningEnabled = !!useLogsPinning();
  return (
    <TableHead>
      <LogTableRow>
        <FirstTableHeadCell isFirst align="left">
          <TableHeadCellContent isFrozen />
        </FirstTableHeadCell>
        {fields.map((field, index) => {
          const direction = sortBys.find(s => s.field === field)?.kind;

          const fieldType = resolvedMeta.fields[field];
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

function ErrorRenderer({error, onRetry}: {error?: unknown; onRetry?: () => void}) {
  return (
    <TableStatus>
      {isRateLimitError(error) ? (
        <LogsRateLimitError onRetry={onRetry} />
      ) : (
        <IconWarning variant="muted" size="lg" />
      )}
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

export function addValidatedFieldTypesToLogsMeta({
  meta,
  validatedFieldTypes,
}: {
  meta: EventsMetaType | undefined;
  validatedFieldTypes: Partial<Record<string, FieldValueType>>;
}): EventsMetaType {
  const fields: Record<string, ColumnType> = {...meta?.fields};

  for (const [field, fieldType] of Object.entries(validatedFieldTypes)) {
    const definitionType = fieldValueTypeToColumnType(
      getFieldDefinition(field, 'log')?.valueType ?? undefined
    );
    const columnType =
      definitionType ?? fields[field] ?? fieldValueTypeToColumnType(fieldType);
    if (columnType) {
      fields[field] = columnType;
    }
  }

  return {...meta, fields, units: meta?.units ?? {}};
}

function fieldValueTypeToColumnType(fieldType?: FieldValueType): ColumnType | undefined {
  if (!fieldType || fieldType === FieldValueType.NEVER) {
    return undefined;
  }

  return fieldType;
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
    <HoveringRowLoadingRendererContainer
      position={position}
      headerHeight={isEmbedded ? 0 : 45}
      height={isEmbedded ? LOGS_GRID_BODY_ROW_HEIGHT * 1 : LOGS_GRID_BODY_ROW_HEIGHT * 3}
    >
      <LoadingIndicator
        size={
          isEmbedded ? LOGS_GRID_BODY_ROW_HEIGHT * 0.8 : LOGS_GRID_BODY_ROW_HEIGHT * 1.5
        }
      />
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

function useBox<T>(value: T): RefObject<T> {
  const box = useRef(value);
  box.current = value;
  return box;
}
