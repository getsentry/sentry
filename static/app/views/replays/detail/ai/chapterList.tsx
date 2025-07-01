import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import EmptyMessage from 'sentry/components/emptyMessage';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import BreadcrumbRow from 'sentry/views/replays/detail/breadcrumbs/breadcrumbRow';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

import type {SummaryResponse} from './useFetchReplaySummary';

interface Props {
  summaryData: SummaryResponse;
}

export function ChapterList({summaryData}: Props) {
  const {replay, setCurrentTime} = useReplayContext();
  const onClickChapterTimestamp = useCallback(
    (event: React.MouseEvent<Element>, start: number) => {
      event.stopPropagation();
      setCurrentTime(start - (replay?.getStartTimestampMs() ?? 0));
    },
    [replay, setCurrentTime]
  );

  const chapterData = useMemo(
    () =>
      summaryData?.data.time_ranges
        .map(({period_title, period_start, period_end}) => ({
          title: period_title,
          start: period_start,
          end: period_end,
          breadcrumbs:
            replay
              ?.getChapterFrames()
              .filter(
                breadcrumb =>
                  breadcrumb.timestampMs >= period_start &&
                  breadcrumb.timestampMs <= period_end
              ) ?? [],
        }))
        .sort((a, b) => a.start - b.start),
    [summaryData, replay]
  );

  return (
    <ChaptersList>
      {chapterData.map(({title, start, end, breadcrumbs}, i) => (
        <ChapterRow
          key={i}
          title={title}
          start={start}
          end={end}
          breadcrumbs={breadcrumbs}
          onClickChapterTimestamp={onClickChapterTimestamp}
        />
      ))}
    </ChaptersList>
  );
}

function ChapterRow({
  title,
  start,
  end,
  breadcrumbs,
  onClickChapterTimestamp,
  className,
}: {
  breadcrumbs: ReplayFrame[];
  end: number;
  onClickChapterTimestamp: (event: React.MouseEvent<Element>, start: number) => void;
  start: number;
  title: string;
  className?: string;
}) {
  const {replay, currentTime} = useReplayContext();
  const {onClickTimestamp} = useCrumbHandlers();
  const [currentHoverTime] = useCurrentHoverTime();

  const startOffset = Math.max(start - (replay?.getStartTimestampMs() ?? 0), 0);
  const endOffset = Math.max(end - (replay?.getStartTimestampMs() ?? 0), 0);
  const hasOccurred = currentTime >= startOffset;
  const isBeforeHover = currentHoverTime === undefined || currentHoverTime >= startOffset;

  return (
    <ChapterWrapper
      className={classNames(className, {
        beforeCurrentTime: hasOccurred,
        afterCurrentTime: !hasOccurred,
        activeChapter: currentTime >= startOffset && currentTime <= endOffset,
        beforeHoverTime: currentHoverTime === undefined ? undefined : isBeforeHover,
        afterHoverTime: currentHoverTime === undefined ? undefined : !isBeforeHover,
      })}
    >
      <Chapter>
        <ChapterIconArrowWrapper>
          <ChapterIconArrow direction="right" size="xs" />
        </ChapterIconArrowWrapper>
        <ChapterTitle>
          <span>{title}</span>

          <ReplayTimestamp>
            <TimestampButton
              startTimestampMs={replay?.getStartTimestampMs() ?? 0}
              timestampMs={start}
              onClick={event => {
                onClickChapterTimestamp(event, start);
              }}
            />
          </ReplayTimestamp>
        </ChapterTitle>
      </Chapter>
      <div>
        {!breadcrumbs.length && (
          <EmptyMessage>{t('No breadcrumbs for this chapter')}</EmptyMessage>
        )}
        {breadcrumbs.map((breadcrumb, j) => (
          <ChapterBreadcrumbRow
            frame={breadcrumb}
            index={j}
            onClick={onClickTimestamp}
            onInspectorExpanded={() => {}}
            onShowSnippet={() => {}}
            showSnippet={false}
            allowShowSnippet={false}
            startTimestampMs={replay?.getStartTimestampMs() ?? 0}
            key={`breadcrumb-${j}`}
            style={{}}
          />
        ))}
      </div>
    </ChapterWrapper>
  );
}

const ChapterIconArrowWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)} ${space(0.5)};
  background-color: ${p => p.theme.background};
  z-index: 2; /* needs to be above "ChapterWrapper summary::after" */
`;

const ChapterIconArrow = styled(IconChevron)`
  details[open] & {
    transform: rotate(180deg);
  }
`;

const ChaptersList = styled('div')`
  flex: 1;
  overflow: auto;
`;

const ChapterWrapper = styled('details')`
  width: 100%;
  position: relative;
  margin: 0;

  /* vertical line connecting items */
  summary::after {
    content: '';
    position: absolute;
    left: 16.5px;
    width: 1px;
    top: 1px;
    bottom: -9px;
    background: ${p => p.theme.innerBorder};
  }

  &:first-child summary::after {
    top: 12px;
  }

  &:last-child summary::after {
    bottom: 0;
  }

  &.activeChapter .beforeCurrentTime:last-child {
    border-bottom-color: ${p => p.theme.purple300};
  }
`;

const ChapterBreadcrumbRow = styled(BreadcrumbRow)`
  padding: ${space(0.5)} ${space(0.75)};

  &::before {
    display: none;
  }
  &:last-child {
    background-color: transparent;
  }
  details[open]:last-child &:last-child {
    background-color: ${p => p.theme.background};
  }
`;

const Chapter = styled('summary')`
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.lg};
  padding: 0 ${space(0.75)};

  /* sorry */
  &:focus-visible {
    outline: none;
  }

  list-style-type: none;
  &::-webkit-details-marker {
    display: none;
  }
`;

const ChapterTitle = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  gap: ${space(1)};
  justify-content: space-between;
  font-size: ${p => p.theme.fontSize.md};
  padding: ${space(1)} 0;

  .activeChapter & {
    font-weight: ${p => p.theme.fontWeight.bold};
  }

  :not(details[open] &) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
  details:last-child:not([open]) & {
    border-bottom: none;
  }
`;

// Copied from breadcrumbItem
const ReplayTimestamp = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
`;
