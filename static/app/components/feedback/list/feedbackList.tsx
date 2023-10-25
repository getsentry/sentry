import {Fragment, useEffect, useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  InfiniteLoader,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import {useInfiniteFeedbackListData} from 'sentry/components/feedback/feedbackDataContext';
import FeedbackListHeader from 'sentry/components/feedback/list/feedbackListHeader';
import FeedbackListItem from 'sentry/components/feedback/list/feedbackListItem';
import useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
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
    // error,
    // hasNextPage,
    // isError,
    isFetching, // If the network is active
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading, // If anything is loaded yet
    // Below are fields that are shims for react-virtualized
    getRow,
    isRowLoaded,
    issues,
    loadMoreRows,
    // setFeedback,
  } = useInfiniteFeedbackListData();

  const {setParamValue} = useUrlParams('query');
  const clearSearchTerm = () => setParamValue('');

  const {checked, toggleChecked} = useListItemCheckboxState();

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
          style={style}
          isChecked={checked.includes(item.feedback_id)}
          onChecked={() => {
            toggleChecked(item.feedback_id);
          }}
        />
      </CellMeasurer>
    );
  };

  return (
    <Fragment>
      <FeedbackListHeader checked={checked} toggleChecked={toggleChecked} />
      <OverflowPanelItem noPadding>
        <InfiniteLoader
          isRowLoaded={isRowLoaded}
          loadMoreRows={loadMoreRows}
          rowCount={issues.length}
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
                        {t('No feedback received')}
                      </NoRowRenderer>
                    )
                  }
                  onRowsRendered={onRowsRendered}
                  overscanRowCount={5}
                  ref={e => {
                    registerChild(e);
                  }}
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
