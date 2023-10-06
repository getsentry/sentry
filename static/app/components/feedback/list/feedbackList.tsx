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
import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
  const {getRow, isRowLoaded, loadMoreRows, totalHits, countLoadedRows, queryView} =
    useInfiniteFeedbackListData();

  const {setParamValue} = useUrlParams('query');
  const clearSearchTerm = () => setParamValue('');

  const {checked, toggleChecked} = useListItemCheckboxState();

  const listRef = useRef<ReactVirtualizedList>(null);

  const hasRows = totalHits === undefined ? true : totalHits > 0;
  const deps = useMemo(() => [queryView, hasRows], [queryView, hasRows]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });

  useEffect(() => {
    updateList();
  }, [updateList, countLoadedRows]);

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
      <FeedbackListHeader checked={checked} />
      <OverflowPanelItem noPadding>
        <InfiniteLoader
          isRowLoaded={isRowLoaded}
          loadMoreRows={loadMoreRows}
          rowCount={totalHits}
        >
          {({onRowsRendered, registerChild}) => (
            <AutoSizer onResize={updateList}>
              {({width, height}) => (
                <ReactVirtualizedList
                  deferredMeasurementCache={cache}
                  height={height}
                  noRowsRenderer={() => (
                    <NoRowRenderer
                      unfilteredItems={totalHits === undefined ? [undefined] : []}
                      clearSearchTerm={clearSearchTerm}
                    >
                      {t('No feedback received')}
                    </NoRowRenderer>
                  )}
                  onRowsRendered={onRowsRendered}
                  overscanRowCount={5}
                  ref={e => {
                    registerChild(e);
                  }}
                  rowCount={totalHits === undefined ? 1 : totalHits}
                  rowHeight={cache.rowHeight}
                  rowRenderer={renderRow}
                  width={width}
                />
              )}
            </AutoSizer>
          )}
        </InfiniteLoader>
      </OverflowPanelItem>
    </Fragment>
  );
}

const OverflowPanelItem = styled(PanelItem)`
  overflow: scroll;
  padding: ${space(0.5)};

  flex-direction: column;
  flex-grow: 1;
  gap: ${space(1)};
`;
