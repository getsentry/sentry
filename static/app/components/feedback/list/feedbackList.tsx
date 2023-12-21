import {Fragment, useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  InfiniteLoader,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import FeedbackListHeader from 'sentry/components/feedback/list/feedbackListHeader';
import FeedbackListItem from 'sentry/components/feedback/list/feedbackListItem';
import useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
import useFetchFeedbackInfiniteListData from 'sentry/components/feedback/useFetchFeedbackInfiniteListData';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelItem from 'sentry/components/panels/panelItem';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 24,
};

function NoFeedback({title, subtitle}: {subtitle: string; title: string}) {
  return (
    <Wrapper>
      <img src={waitingForEventImg} alt="No feedback found spot illustration" />
      <EmptyMessage>{title}</EmptyMessage>
      <p>{subtitle}</p>
    </Wrapper>
  );
}

export default function FeedbackList() {
  const {
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading, // If anything is loaded yet
    getRow,
    isRowLoaded,
    issues,
    loadMoreRows,
    hits,
  } = useFetchFeedbackInfiniteListData();

  const checkboxState = useListItemCheckboxState({
    hits,
    knownIds: issues.map(issue => issue.id),
  });

  const listRef = useRef<ReactVirtualizedList>(null);

  const deps = useMemo(() => [isLoading, issues.length], [isLoading, issues.length]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });

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
          rowCount={hits}
        >
          {({onRowsRendered, registerChild}) => (
            <AutoSizer onResize={updateList}>
              {({width, height}) => (
                <ReactVirtualizedList
                  deferredMeasurementCache={cache}
                  height={height}
                  noRowsRenderer={() =>
                    isLoading ? (
                      <LoadingIndicator />
                    ) : (
                      <NoFeedback
                        title={t('Inbox Zero')}
                        subtitle={t('You have two options: take a nap or be productive.')}
                      />
                    )
                  }
                  onRowsRendered={onRowsRendered}
                  overscanRowCount={5}
                  ref={e => {
                    // @ts-expect-error: Cannot assign to current because it is a read-only property.
                    listRef.current = e;
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
  min-height: 300px;
`;

const FloatingContainer = styled('div')`
  position: absolute;
  justify-self: center;
`;

const Wrapper = styled('div')`
  display: flex;
  padding: ${space(4)} ${space(4)};
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: ${p => p.theme.subText};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    font-size: ${p => p.theme.fontSizeMedium};
  }
  position: relative;
  top: 50%;
  transform: translateY(-50%);
`;

const EmptyMessage = styled('div')`
  font-weight: 600;
  color: ${p => p.theme.gray400};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    font-size: ${p => p.theme.fontSizeExtraLarge};
  }
`;
