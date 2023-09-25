import {Fragment, useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import FeedbackListItem from 'sentry/components/feedback/list/feedbackListItem';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  FeedbackItemLoaderQueryParams,
  HydratedFeedbackItem,
} from 'sentry/utils/feedback/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
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
  const location = useLocation<FeedbackItemLoaderQueryParams>();
  const feedbackSlug = decodeScalar(location.query.feedbackSlug);
  const [, feedbackId] = feedbackSlug?.split(':') ?? [];

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
    const isSelected = feedbackId === item.feedback_id;

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <FeedbackListItem feedbackItem={item} isSelected={isSelected} style={style} />
      </CellMeasurer>
    );
  };

  return (
    <Fragment>
      <HeaderPanelItem>fixed header</HeaderPanelItem>
      <OverflowPanelItem>
        {!items ? (
          <Placeholder height="100%" />
        ) : (
          <AutoSizer onResize={updateList}>
            {({width, height}) => (
              <ReactVirtualizedList
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={items}
                    clearSearchTerm={clearSearchTerm}
                  >
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
        )}
      </OverflowPanelItem>
    </Fragment>
  );
}

const HeaderPanelItem = styled(PanelItem)`
  display: grid;
  padding: ${space(1)} ${space(2)};
`;

const OverflowPanelItem = styled('div')`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  gap: ${space(3)};

  overflow: scroll;
  padding: ${space(0.5)};
`;
