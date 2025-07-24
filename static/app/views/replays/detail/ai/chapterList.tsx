import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {Alert} from 'sentry/components/core/alert';
import {Link} from 'sentry/components/core/link';
import EmptyMessage from 'sentry/components/emptyMessage';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconChevron, IconFire, IconMegaphone} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import BreadcrumbRow from 'sentry/views/replays/detail/breadcrumbs/breadcrumbRow';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

import type {SummaryResponse} from './useFetchReplaySummary';

interface Props {
  summaryData: SummaryResponse;
}

export function ChapterList({summaryData}: Props) {
  const replay = useReplayReader();
  const {setCurrentTime} = useReplayContext();
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
        .map(({period_title, period_start, period_end, error, feedback}) => ({
          title: period_title,
          start: period_start,
          end: period_end,
          error,
          feedback,
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

  if (!chapterData.length) {
    return (
      <EmptyContainer>
        <Alert type="info" showIcon={false}>
          {t('No chapters available for this replay.')}
        </Alert>
      </EmptyContainer>
    );
  }

  return (
    <ChaptersList>
      {chapterData.map(({title, start, end, breadcrumbs, error, feedback}, i) => (
        <ChapterRow
          key={i}
          title={title}
          start={start}
          end={end}
          breadcrumbs={breadcrumbs}
          onClickChapterTimestamp={onClickChapterTimestamp}
          error={error}
          feedback={feedback}
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
  error,
  feedback,
}: {
  breadcrumbs: ReplayFrame[];
  end: number;
  error: boolean;
  feedback: boolean;
  onClickChapterTimestamp: (event: React.MouseEvent<Element>, start: number) => void;
  start: number;
  title: string;
  className?: string;
}) {
  const replay = useReplayReader();
  const {currentTime, setCurrentTime} = useReplayContext();
  const organization = useOrganization();
  const location = useLocation();
  const {onClickTimestamp} = useCrumbHandlers();
  const [currentHoverTime] = useCurrentHoverTime();
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const startOffset = Math.max(start - (replay?.getStartTimestampMs() ?? 0), 0);
  const endOffset = Math.max(end - (replay?.getStartTimestampMs() ?? 0), 0);
  const hasOccurred = currentTime >= startOffset;
  const isBeforeHover = currentHoverTime === undefined || currentHoverTime >= startOffset;

  return (
    <ChapterWrapper
      data-has-error={Boolean(error)}
      data-has-feedback={Boolean(feedback)}
      className={classNames(className, {
        beforeCurrentTime: hasOccurred,
        afterCurrentTime: !hasOccurred,
        activeChapter: currentTime >= startOffset && currentTime <= endOffset,
        beforeHoverTime: currentHoverTime === undefined ? undefined : isBeforeHover,
        afterHoverTime: currentHoverTime === undefined ? undefined : !isBeforeHover,
      })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onToggle={e => setIsOpen(e.currentTarget.open)}
    >
      <Chapter
        onClick={() =>
          trackAnalytics('replay.ai-summary.chapter-clicked', {
            chapter_type: error ? 'error' : feedback ? 'feedback' : undefined,
            organization,
          })
        }
      >
        <ChapterIconWrapper>
          {error ? (
            isOpen || isHovered ? (
              <ChapterIconArrow direction="right" size="xs" color="red300" />
            ) : (
              <IconFire size="xs" color="red300" />
            )
          ) : feedback ? (
            isOpen || isHovered ? (
              <ChapterIconArrow direction="right" size="xs" color="pink300" />
            ) : (
              <IconMegaphone size="xs" color="pink300" />
            )
          ) : (
            <ChapterIconArrow direction="right" size="xs" />
          )}
        </ChapterIconWrapper>
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
            -
            <TimestampButton
              startTimestampMs={replay?.getStartTimestampMs() ?? 0}
              timestampMs={end}
              onClick={event => {
                onClickChapterTimestamp(event, end);
              }}
            />
          </ReplayTimestamp>
        </ChapterTitle>
      </Chapter>
      <div>
        {!breadcrumbs.length && (
          <EmptyMessage>
            {tct(
              'No breadcrumbs for this chapter, but there may be [consoleLogs: console logs] or [networkRequests: network requests] that occurred during this window.',
              {
                consoleLogs: (
                  <Link
                    to={{
                      pathname: location.pathname,
                      query: {
                        t_main: TabKey.CONSOLE,
                        t: startOffset / 1000,
                      },
                    }}
                    onClick={() => setCurrentTime(startOffset)}
                  />
                ),
                networkRequests: (
                  <Link
                    to={{
                      pathname: location.pathname,
                      query: {
                        t_main: TabKey.NETWORK,
                        t: startOffset / 1000,
                      },
                    }}
                    onClick={() => setCurrentTime(startOffset)}
                  />
                ),
              }
            )}
          </EmptyMessage>
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

const ChapterIconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(0.5)};
  margin-right: ${space(1)};
  background-color: ${p => p.theme.background};
  border-radius: 50%;
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
    display: none; /* hide the vertical line for the last chapter */
  }

  &.activeChapter .beforeCurrentTime:last-child {
    border-bottom-color: ${p => p.theme.purple300};
  }

  /* the border-top is used to eliminate some of the top gap */

  &:hover {
    border-top: 1px solid ${p => p.theme.backgroundSecondary};
  }

  [data-has-feedback='true'] {
    &:hover {
      border-top: 1px solid ${p => p.theme.pink100};
    }
  }

  [data-has-error='true'] {
    &:hover {
      border-top: 1px solid ${p => p.theme.red100};
    }
  }
`;

const ChapterBreadcrumbRow = styled(BreadcrumbRow)`
  padding: ${space(0.5)} ${space(0.75)};

  &::before {
    display: none;
  }

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const Chapter = styled('summary')`
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.lg};
  padding: 0 ${space(0.75)};
  color: ${p => p.theme.textColor};

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  /* sorry */
  &:focus-visible {
    outline: none;
  }

  list-style-type: none;
  &::-webkit-details-marker {
    display: none;
  }

  [data-has-feedback='true'] & {
    color: ${p => p.theme.pink300};

    &:hover {
      background-color: ${p => p.theme.pink100};
    }
  }

  [data-has-error='true'] & {
    color: ${p => p.theme.red300};

    &:hover {
      background-color: ${p => p.theme.red100};
    }
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

  border-bottom: 1px solid ${p => p.theme.innerBorder};
  margin-bottom: -1px; /* Compensate for border to fully eliminate gap */

  details:last-child:not([open]) & {
    border-bottom: none;
  }
`;

// Copied from breadcrumbItem
const ReplayTimestamp = styled('span')`
  display: flex;
  gap: ${space(0.5)};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const EmptyContainer = styled('div')`
  padding: ${space(2)};
`;
