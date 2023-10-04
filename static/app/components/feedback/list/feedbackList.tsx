import {useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';

import FeedbackListItem from 'sentry/components/feedback/list/feedbackListItem';
import {t} from 'sentry/locale';
import {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 24,
};

interface Props {
  items: HydratedFeedbackItem[];
}

export default function FeedbackList({items}: Props) {
  const clearSearchTerm = () => {}; // setSearchTerm('');

  const listRef = useRef<ReactVirtualizedList>(null);

  const deps = useMemo(() => [items], [items]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const item = items[index];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <FeedbackListItem feedbackItem={item} style={style} />
      </CellMeasurer>
    );
  };

  return (
    <AutoSizer onResize={updateList}>
      {({width, height}) => (
        <ReactVirtualizedList
          deferredMeasurementCache={cache}
          height={height}
          noRowsRenderer={() => (
            <NoRowRenderer unfilteredItems={items} clearSearchTerm={clearSearchTerm}>
              {t('No feedback received')}
            </NoRowRenderer>
          )}
          overscanRowCount={5}
          ref={listRef}
          rowCount={items.length}
          rowHeight={cache.rowHeight}
          rowRenderer={renderRow}
          width={width}
        />
      )}
    </AutoSizer>
  );
}
