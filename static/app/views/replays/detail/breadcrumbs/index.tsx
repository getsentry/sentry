import {useEffect, useMemo, useRef, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Placeholder from 'sentry/components/placeholder';
import JumpButtons from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useJumpButtons from 'sentry/components/replays/useJumpButtons';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useExtractedDomNodes from 'sentry/utils/replays/hooks/useExtractedDomNodes';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';
import useVirtualizedInspector from 'sentry/views/replays/detail//useVirtualizedInspector';
import BreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/breadcrumbFilters';
import BreadcrumbRow from 'sentry/views/replays/detail/breadcrumbs/breadcrumbRow';
import useBreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/useBreadcrumbFilters';
import useScrollToCurrentItem from 'sentry/views/replays/detail/breadcrumbs/useScrollToCurrentItem';
import FilterLoadingIndicator from 'sentry/views/replays/detail/filterLoadingIndicator';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useReplayPerfData from 'sentry/views/replays/detail/perfTable/useReplayPerfData';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';
import useVirtualListDimentionChange from 'sentry/views/replays/detail/useVirtualListDimentionChange';

const LOCAL_STORAGE_KEY = 'replay-details-mask-config-instructions-dismissed';

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 53,
};

function Breadcrumbs() {
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});
  const {currentTime, replay} = useReplayContext();
  const organization = useOrganization();
  const hasPerfTab = organization.features.includes('session-replay-trace-table');

  const {onClickTimestamp} = useCrumbHandlers();
  const {data: frameToExtraction, isFetching: isFetchingExtractions} =
    useExtractedDomNodes({replay});
  const {data: frameToTrace, isFetching: isFetchingTraces} = useReplayPerfData({replay});

  const startTimestampMs = replay?.getReplay()?.started_at?.getTime() ?? 0;
  const frames = replay?.getChapterFrames();

  const [scrollToRow, setScrollToRow] = useState<undefined | number>(undefined);

  const filterProps = useBreadcrumbFilters({frames: frames || []});
  const {expandPathsRef, items, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const listRef = useRef<ReactVirtualizedList>(null);

  const deps = useMemo(() => [items, searchTerm], [items, searchTerm]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });
  const {handleDimensionChange} = useVirtualListDimentionChange({cache, listRef});
  const {handleDimensionChange: handleInspectorExpanded} = useVirtualizedInspector({
    cache,
    listRef,
    expandPathsRef,
  });

  const {
    handleClick: onClickToJump,
    onRowsRendered,
    showJumpDownButton,
    showJumpUpButton,
  } = useJumpButtons({
    currentTime,
    frames: items,
    isTable: false,
    setScrollToRow,
  });

  useScrollToCurrentItem({
    frames,
    ref: listRef,
  });

  // Need to refresh the item dimensions as DOM & Trace data gets loaded
  useEffect(() => {
    if (!isFetchingExtractions || !isFetchingTraces) {
      updateList();
    }
  }, [isFetchingExtractions, isFetchingTraces, updateList]);

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const item = (items || [])[index];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <BreadcrumbRow
          index={index}
          frame={item}
          extraction={frameToExtraction?.get(item)}
          traces={hasPerfTab ? frameToTrace?.get(item) : undefined}
          startTimestampMs={startTimestampMs}
          style={style}
          expandPaths={Array.from(expandPathsRef.current?.get(index) || [])}
          onClick={() => {
            onClickTimestamp(item);
          }}
          onDimensionChange={handleDimensionChange}
          onInspectorExpanded={handleInspectorExpanded}
        />
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <FilterLoadingIndicator isLoading={isFetchingExtractions || isFetchingTraces}>
        <BreadcrumbFilters frames={frames} {...filterProps} />
      </FilterLoadingIndicator>
      {isDismissed ? null : (
        <StyledAlert
          type="info"
          showIcon
          trailingItems={
            <Button
              aria-label={t('Dismiss banner')}
              icon={<IconClose />}
              onClick={dismiss}
              size="zero"
              borderless
            />
          }
        >
          {tct('Learn how to unmask text (****) and unblock media [link:here].', {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/privacy/" />
            ),
          })}
        </StyledAlert>
      )}
      <TabItemContainer data-test-id="replay-details-breadcrumbs-tab">
        {frames ? (
          <AutoSizer onResize={updateList}>
            {({height, width}) => (
              <ReactVirtualizedList
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={frames}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No breadcrumbs recorded')}
                  </NoRowRenderer>
                )}
                onRowsRendered={onRowsRendered}
                onScroll={() => {
                  if (scrollToRow !== undefined) {
                    setScrollToRow(undefined);
                  }
                }}
                overscanRowCount={5}
                ref={listRef}
                rowCount={items.length}
                rowHeight={cache.rowHeight}
                rowRenderer={renderRow}
                scrollToIndex={scrollToRow}
                width={width}
              />
            )}
          </AutoSizer>
        ) : (
          <Placeholder height="100%" />
        )}
        {items?.length ? (
          <JumpButtons
            jump={showJumpUpButton ? 'up' : showJumpDownButton ? 'down' : undefined}
            onClick={onClickToJump}
            tableHeaderHeight={0}
          />
        ) : null}
      </TabItemContainer>
    </FluidHeight>
  );
}

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(1)};
`;

export default Breadcrumbs;
