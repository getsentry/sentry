import {Fragment, useEffect, useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  InfiniteLoader,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import FeedbackListHeader from 'sentry/components/feedback/list/feedbackListHeader';
import FeedbackListItem from 'sentry/components/feedback/list/feedbackListItem';
import useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
import {useHaveSelectedProjectsSetupFeedback} from 'sentry/components/feedback/useFeedbackOnboarding';
import useFetchFeedbackInfiniteListData from 'sentry/components/feedback/useFetchFeedbackInfiniteListData';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelItem from 'sentry/components/panels/panelItem';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import useUrlParams from 'sentry/utils/useUrlParams';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 24,
};

export default function FeedbackList() {
  const {
    hasNextPage,
    isFetching, // If the network is active
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading, // If anything is loaded yet
    getRow,
    isRowLoaded,
    issues,
    loadMoreRows,
    hits,
  } = useFetchFeedbackInfiniteListData();

  const {setParamValue} = useUrlParams('query');
  const clearSearchTerm = () => setParamValue('');

  const checkboxState = useListItemCheckboxState({
    hits,
    knownIds: issues.map(issue => issue.id),
  });

  const {hasSetupOneFeedback} = useHaveSelectedProjectsSetupFeedback();

  const listRef = useRef<ReactVirtualizedList>(null);

  const hasRows = !isLoading;
  const deps = useMemo(() => [hasRows], [hasRows]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });

  useEffect(() => {
    updateList();
  }, [updateList, issues.length]);

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const item = getRow({index});
    if (!item) {
      return null;
    }

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <FeedbackListItem
          feedbackItem={item}
          isSelected={checkboxState.isSelected(item.id)}
          onSelect={() => {
            checkboxState.toggleSelected(item.id);
          }}
          style={style}
        />
      </CellMeasurer>
    );
  };

  return (
    <Fragment>
      <FeedbackListHeader {...checkboxState} />
      <OverflowPanelItem noPadding>
        <InfiniteLoader
          isRowLoaded={isRowLoaded}
          loadMoreRows={loadMoreRows}
          rowCount={hasNextPage ? issues.length + 1 : issues.length}
        >
          {({onRowsRendered, registerChild}) => (
            <AutoSizer onResize={updateList}>
              {({width, height}) => (
                <ReactVirtualizedList
                  deferredMeasurementCache={cache}
                  height={height}
                  noRowsRenderer={() =>
                    isFetching ? (
                      <LoadingIndicator />
                    ) : (
                      <NoRowRenderer
                        unfilteredItems={issues}
                        clearSearchTerm={clearSearchTerm}
                      >
                        {hasSetupOneFeedback
                          ? t('No feedback found')
                          : t('No feedback received yet')}
                      </NoRowRenderer>
                    )
                  }
                  onRowsRendered={onRowsRendered}
                  overscanRowCount={5}
                  ref={registerChild}
                  rowCount={issues.length}
                  rowHeight={cache.rowHeight}
                  rowRenderer={renderRow}
                  width={width}
                />
              )}
            </AutoSizer>
          )}
        </InfiniteLoader>
        <FloatingContainer style={{top: '2px'}}>
          {isFetchingPreviousPage ? (
            <Tooltip title={t('Loading more feedback...')}>
              <LoadingIndicator mini />
            </Tooltip>
          ) : null}
        </FloatingContainer>
        <FloatingContainer style={{bottom: '2px'}}>
          {isFetchingNextPage ? (
            <Tooltip title={t('Loading more feedback...')}>
              <LoadingIndicator mini />
            </Tooltip>
          ) : null}
        </FloatingContainer>
      </OverflowPanelItem>
    </Fragment>
  );
}

const OverflowPanelItem = styled(PanelItem)`
  display: grid;
  overflow: scroll;
  flex-grow: 1;
`;

const FloatingContainer = styled('div')`
  position: absolute;
  justify-self: center;
`;
