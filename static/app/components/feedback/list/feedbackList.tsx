import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import type {ListRowProps} from 'react-virtualized';
import {
  AutoSizer,
  CellMeasurer,
  InfiniteLoader,
  List as ReactVirtualizedList,
} from 'react-virtualized';
import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackListHeader from 'sentry/components/feedback/list/feedbackListHeader';
import FeedbackListItem from 'sentry/components/feedback/list/feedbackListItem';
import SentimentOverTimeChart from 'sentry/components/feedback/list/sentimentOverTimeChart';
import {
  getSentimentIcon,
  getSentimentType,
} from 'sentry/components/feedback/list/summaryUtils';
import useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
import useSentimentKeyword from 'sentry/components/feedback/list/useSentimentKeyword';
import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useFetchInfiniteListData from 'sentry/utils/api/useFetchInfiniteListData';
import type {FeedbackIssueListItem} from 'sentry/utils/feedback/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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

interface FeedbackListProps {
  feedbackSummary: {
    error: Error | null;
    keySentiments: Array<{
      type: 'positive' | 'negative' | 'neutral';
      value: string;
    }>;
    loading: boolean;
    summary: string | null;
  };
  isHelpful: boolean | null;
  setIsHelpful: (isHelpful: boolean) => void;
}

export default function FeedbackList({
  feedbackSummary,
  setIsHelpful,
  isHelpful,
}: FeedbackListProps) {
  const {listQueryKey} = useFeedbackQueryKeys();
  const location = useLocation();
  const navigate = useNavigate();

  const {summary, keySentiments, loading: summaryLoading} = feedbackSummary;
  const [selectedSentiment, setSelectedSentiment] = useState<string | null>(null);
  // keyword used for search when a sentiment is selected
  const {keyword} = useSentimentKeyword({sentiment: selectedSentiment});
  const [selectValue, setSelectValue] = useState<string>('summary');

  const prevKeywordRef = useRef(keyword);
  const prevSelectedSentimentRef = useRef(selectedSentiment);
  const locationRef = useRef({pathname: location.pathname, query: location.query});

  useEffect(() => {
    locationRef.current = {pathname: location.pathname, query: location.query};
  }, [location]);

  useEffect(() => {
    if (
      keyword &&
      selectedSentiment &&
      (prevSelectedSentimentRef.current !== selectedSentiment ||
        prevKeywordRef.current !== keyword)
    ) {
      prevSelectedSentimentRef.current = selectedSentiment;
      prevKeywordRef.current = keyword;
      navigate({
        pathname: locationRef.current.pathname,
        query: {...locationRef.current.query, query: keyword},
      });
    }
  }, [keyword, selectedSentiment, navigate]);

  const {
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading, // If anything is loaded yet
    getRow,
    isRowLoaded,
    issues,
    loadMoreRows,
    hits,
  } = useFetchInfiniteListData<FeedbackIssueListItem>({
    queryKey: listQueryKey ?? [''],
    uniqueField: 'id',
    enabled: Boolean(listQueryKey),
  });

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
      <ErrorBoundary mini key={key}>
        <CellMeasurer cache={cache} columnIndex={0} parent={parent} rowIndex={index}>
          <FeedbackListItem
            feedbackItem={item}
            isSelected={checkboxState.isSelected(item.id)}
            onSelect={() => {
              checkboxState.toggleSelected(item.id);
            }}
            style={style}
          />
        </CellMeasurer>
      </ErrorBoundary>
    );
  };

  return (
    <Fragment>
      <Summary>
        <SummaryHeader>
          <StyledCompactSelect
            options={[
              {value: 'summary', label: t('Feedback Summary')},
              {value: 'sentimentOverTime', label: t('Sentiment Over Time')},
            ]}
            onChange={option => setSelectValue(String(option.value))}
            value={selectValue}
          />
          {selectValue === 'summary' && (
            <Thumbs>
              {
                <Button
                  title={t('This summary is helpful')}
                  borderless
                  size="xs"
                  onClick={() => setIsHelpful(true)}
                >
                  <IconThumb color={isHelpful ? 'green400' : undefined} direction="up" />
                </Button>
              }
              {
                <Button
                  title={t('This summary is not helpful. Click to update.')}
                  borderless
                  size="xs"
                  onClick={() => setIsHelpful(false)}
                >
                  <IconThumb
                    color={isHelpful === false ? 'red400' : undefined}
                    direction="down"
                  />
                </Button>
              }
            </Thumbs>
          )}
        </SummaryHeader>
        {selectValue === 'summary' ? (
          summaryLoading ? (
            <Placeholder height="200px" />
          ) : (
            <Fragment>
              <div>{summary}</div>
              <KeySentiments>
                {keySentiments.map(sentiment => (
                  <SentimentTag
                    key={sentiment.value}
                    icon={getSentimentIcon(sentiment.type)}
                    type={getSentimentType(sentiment.type)}
                    onClick={e => {
                      const targetSentiment = (e.target as HTMLElement).textContent ?? '';
                      setSelectedSentiment(targetSentiment);
                    }}
                  >
                    {sentiment.value}
                  </SentimentTag>
                ))}
              </KeySentiments>
            </Fragment>
          )
        ) : (
          <SentimentOverTimeChart />
        )}
      </Summary>
      <FeedbackListHeader {...checkboxState} />
      <FeedbackListItems>
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
      </FeedbackListItems>
    </Fragment>
  );
}

const SummaryHeader = styled('div')`
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Thumbs = styled('div')`
  display: flex;
  gap: ${space(0.25)};
`;

const Summary = styled('div')`
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const KeySentiments = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: flex-start;
`;

const SentimentTag = styled(Tag)`
  cursor: pointer;
  max-width: 100%;
`;

const FeedbackListItems = styled('div')`
  display: grid;
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
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.gray400};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    font-size: ${p => p.theme.fontSizeExtraLarge};
  }
`;

const StyledCompactSelect = styled(CompactSelect)`
  > button {
    border: none;
    border-color: transparent;
    box-shadow: none;
  }
`;
