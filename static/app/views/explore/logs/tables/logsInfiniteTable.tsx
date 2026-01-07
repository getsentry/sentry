import type {CSSProperties, RefObject} from 'react';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {Virtualizer} from '@tanstack/react-virtual';
import {useVirtualizer, useWindowVirtualizer} from '@tanstack/react-virtual';

import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import FileSize from 'sentry/components/fileSize';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import JumpButtons from 'sentry/components/replays/jumpButtons';
import useJumpButtons from 'sentry/components/replays/useJumpButtons';
import {GridResizer} from 'sentry/components/tables/gridEditable/styles';
import {IconArrow, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
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
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LOGS_INSTRUCTIONS_URL,
  MINIMUM_INFINITE_SCROLL_FETCH_COOLDOWN_MS,
  QUANTIZE_MINUTES,
} from 'sentry/views/explore/logs/constants';
import {
  FirstTableHeadCell,
  FloatingBackToTopContainer,
  FloatingBottomContainer,
  HoveringRowLoadingRendererContainer,
  LOGS_GRID_BODY_ROW_HEIGHT,
  LogTableBody,
  LogTableRow,
} from 'sentry/views/explore/logs/styles';
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
  additionalData?: {
    event?: Event;
    scrollToDisabled?: boolean;
  };
  allowPagination?: boolean;
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
  scrollContainer?: React.RefObject<HTMLElement | null>;
  stringAttributes?: TagCollection;
};

const {info, fmt} = Sentry.logger;

const LOGS_GRID_SCROLL_PIXEL_REVERSE_THRESHOLD = LOGS_GRID_BODY_ROW_HEIGHT * 2; // If you are less than this number of pixels from the top of the table while scrolling backward, fetch the previous page.
const LOGS_OVERSCAN_AMOUNT = 50; // How many items to render beyond the visible area.

export function LogsInfiniteTable({
  embedded = false,
  localOnlyItemFilters,
  emptyRenderer,
  numberAttributes,
  stringAttributes,
  scrollContainer,
  embeddedStyling,
  embeddedOptions,
  additionalData,
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
    isFetchingNextPage,
    isFetchingPreviousPage,
    lastPageLength,
    isRefetching,
    bytesScanned,
    canResumeAutoFetch,
    resumeAutoFetch,
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

  const data: LogTableRowItem[] = useMemo(() => {
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
  const [expandedLogRows, setExpandedLogRows] = useState<Set<string>>(
    new Set(embeddedOptions?.openWithExpandedIds ?? [])
  );
  const [expandedLogRowsHeights, setExpandedLogRowsHeights] = useState<
    Record<string, number>
  >({});
  const [isFunctionScrolling, setIsFunctionScrolling] = useState(false);
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

  const highlightTerms = useMemo(() => {
    const terms = getLogBodySearchTerms(search);
    if (localOnlyItemFilters?.filterText) {
      terms.push(localOnlyItemFilters.filterText);
    }
    return terms;
  }, [search, localOnlyItemFilters?.filterText]);

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
      scrollContainer?.current &&
      !additionalData?.scrollToDisabled
    ) {
      setTimeout(() => {
        const scrollToIndex =
          pseudoRowIndex === -2 ? baseDataLength.current : pseudoRowIndex;
        containerVirtualizer.scrollToIndex(scrollToIndex, {
          behavior: 'smooth',
          align: 'center',
        });
      }, 100);
    }
  }, [
    pseudoRowIndex,
    containerVirtualizer,
    scrollContainer,
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
  }, []);

  const tableStaticCSS = useMemo(() => {
    return {
      '.log-table-row-chevron-button': {
        width: '24px',
        height: '24px',
        padding: `${space(0.5)} ${space(0.75)}`,
        marginRight: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    };
  }, []);

  // For replay context, render empty states outside the table for proper centering
  if (hasReplay && (isPending || isError || isEmpty)) {
    return (
      <Fragment>
        <CenteredEmptyStateContainer>
          {isPending && <LoadingRenderer />}
          {isError && <ErrorRenderer />}
          {isEmpty && (emptyRenderer ? emptyRenderer() : <EmptyRenderer />)}
        </CenteredEmptyStateContainer>
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
      <Table
        ref={tableRef}
        style={initialTableStyles}
        css={tableStaticCSS}
        hideBorder={embedded}
        data-test-id="logs-table"
        showVerticalScrollbar={embeddedStyling?.showVerticalScrollbar}
      >
        {embedded ? null : (
          <LogsTableHeader
            isFrozen={embedded}
            numberAttributes={numberAttributes}
            stringAttributes={stringAttributes}
            onResizeMouseDown={onResizeMouseDown}
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
          {!hasReplay && isPending && <LoadingRenderer bytesScanned={bytesScanned} />}
          {!hasReplay && isError && <ErrorRenderer />}
          {!hasReplay &&
            isEmpty &&
            (emptyRenderer ? (
              emptyRenderer()
            ) : (
              <EmptyRenderer
                bytesScanned={bytesScanned}
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
            return (
              <Fragment key={virtualRow.key}>
                <LogRowContent
                  dataRow={dataRow}
                  meta={meta}
                  highlightTerms={highlightTerms}
                  embedded={embedded}
                  embeddedOptions={embeddedOptions}
                  sharedHoverTimeoutRef={sharedHoverTimeoutRef}
                  key={virtualRow.key}
                  canDeferRenderElements
                  onExpand={handleExpand}
                  onCollapse={handleCollapse}
                  logStart={logStart}
                  logEnd={logEnd}
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
            <HoveringRowLoadingRenderer position="bottom" isEmbedded={embedded} />
          )}
        </LogTableBody>
      </Table>
      <FloatingBackToTopContainer
        inReplay={!!embeddedOptions?.replay}
        tableLeft={tableRef.current?.getBoundingClientRect().left ?? 0}
        tableWidth={tableRef.current?.getBoundingClientRect().width ?? 0}
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
      <FloatingBottomContainer
        tableWidth={tableRef.current?.getBoundingClientRect().width ?? 0}
      >
        {embeddedOptions?.replay && showJumpDownButton ? (
          <JumpButtons jump="down" onClick={onClickToJump} tableHeaderHeight={0} />
        ) : null}
      </FloatingBottomContainer>
    </Fragment>
  );
}

function LogsTableHeader({
  isFrozen,
  numberAttributes,
  stringAttributes,
  onResizeMouseDown,
}: Pick<LogsTableProps, 'numberAttributes' | 'stringAttributes'> & {
  isFrozen: boolean;
  onResizeMouseDown: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
}) {
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const setSortBys = useSetQueryParamsSortBys();

  const {data, meta, isError, isPending} = useLogsPageDataQueryResult();
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
                onClick={
                  isFrozen
                    ? undefined
                    : () => {
                        const kind = direction === 'desc' ? 'asc' : 'desc';
                        setSortBys([{field, kind}]);
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
            </TableHeadCell>
          );
        })}
      </LogTableRow>
    </TableHead>
  );
}

function EmptyRenderer({
  bytesScanned,
  canResumeAutoFetch,
  resumeAutoFetch,
}: {
  bytesScanned?: number;
  canResumeAutoFetch?: boolean;
  resumeAutoFetch?: () => void;
}) {
  if (bytesScanned && canResumeAutoFetch && resumeAutoFetch) {
    return (
      <TableStatus>
        <EmptyStateWarning withIcon>
          <EmptyStateText size="xl">{t('No logs found yet')}</EmptyStateText>
          <EmptyStateText size="md">
            {tct(
              'We scanned [bytesScanned] already but did not find any matching logs yet.[break]You can narrow your time range or you can [continueScanning].',
              {
                bytesScanned: <FileSize bytes={bytesScanned} base={2} />,
                break: <br />,
                continueScanning: (
                  <Button
                    priority="link"
                    onClick={resumeAutoFetch}
                    aria-label={t('continue scanning')}
                  >
                    {t('Continue Scanning')}
                  </Button>
                ),
              }
            )}
          </EmptyStateText>
        </EmptyStateWarning>
      </TableStatus>
    );
  }

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
      <IconWarning variant="muted" size="lg" />
    </TableStatus>
  );
}

export function LoadingRenderer({bytesScanned}: {bytesScanned?: number}) {
  return (
    <TableStatus>
      <LoadingStateContainer>
        <EmptyStateText size="md" textAlign="center">
          <StyledLoadingIndicator margin="1em auto" />
          {defined(bytesScanned) && bytesScanned > 0 && (
            <Fragment>
              {t('Searching for a needle in a haystack. This could take a while.')}
              <br />
              <span>
                {tct('[bytesScanned] scanned', {
                  bytesScanned: <FileSize bytes={bytesScanned} base={2} />,
                })}
              </span>
            </Fragment>
          )}
        </EmptyStateText>
      </LoadingStateContainer>
    </TableStatus>
  );
}

const LoadingStateContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

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

const CenteredEmptyStateContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 200px;
`;

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
