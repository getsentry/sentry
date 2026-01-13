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
import {isErrorFrame, isFeedbackFrame} from 'sentry/utils/replays/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimeRanges} from 'sentry/views/replays/detail/ai/utils';
import BreadcrumbRow from 'sentry/views/replays/detail/breadcrumbs/breadcrumbRow';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

interface Props {
  timeRanges: TimeRanges;
}

export function ChapterList({timeRanges}: Props) {
  const replay = useReplayReader();
  const {setCurrentTime} = useReplayContext();
  const onClickChapterTimestamp = useCallback(
    (event: React.MouseEvent<Element>, start: number) => {
      event.stopPropagation();
      setCurrentTime(start - (replay?.getStartTimestampMs() ?? 0));
    },
    [replay, setCurrentTime]
  );

  // do not include chapters that are before the start of the replay;
  // we filter these crumbs on the frontend anyway
  const chapterData = useMemo(
    () =>
      timeRanges
        .filter(
          ({period_start, period_end}) =>
            period_start >= (replay?.getStartTimestampMs() ?? 0) &&
            period_end >= (replay?.getStartTimestampMs() ?? 0)
        )
        .map(({period_title, period_start, period_end}) => ({
          title: period_title,
          start: period_start,
          end: period_end,
          breadcrumbs:
            replay
              ?.getSummaryChapterFrames()
              .filter(
                breadcrumb =>
                  breadcrumb.timestampMs >= period_start &&
                  breadcrumb.timestampMs <= period_end
              ) ?? [],
        }))
        .sort((a, b) => a.start - b.start),
    [timeRanges, replay]
  );

  if (!chapterData?.length) {
    return (
      <EmptyContainer>
        <Alert variant="info" showIcon={false}>
          {t('No chapters available for this replay.')}
        </Alert>
      </EmptyContainer>
    );
  }

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

  const isError = breadcrumbs.some(isErrorFrame);
  const isFeedback = !isError && breadcrumbs.some(isFeedbackFrame);

  return (
    <ChapterWrapper
      data-is-error={isError}
      data-is-feedback={isFeedback}
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
            chapter_type: isError ? 'error' : isFeedback ? 'feedback' : undefined,
            organization,
          })
        }
      >
        <ChapterIconWrapper>
          {isError ? (
            isOpen || isHovered ? (
              <ChapterIconArrow direction="right" size="xs" variant="danger" />
            ) : (
              <IconFire size="xs" variant="danger" />
            )
          ) : isFeedback ? (
            isOpen || isHovered ? (
              <ChapterIconArrow direction="right" size="xs" variant="promotion" />
            ) : (
              <IconMegaphone size="xs" variant="promotion" />
            )
          ) : (
            <ChapterIconArrow direction="right" size="xs" />
          )}
        </ChapterIconWrapper>
        <ChapterTitle>
          <span style={{gridArea: 'title'}}>{title}</span>

          <ReplayTimestamp style={{gridArea: 'timestamp'}}>
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
  background-color: ${p => p.theme.tokens.background.primary};
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
    background: ${p => p.theme.tokens.border.secondary};
  }

  &:first-child summary::after {
    top: 12px;
  }

  &:last-child summary::after {
    bottom: 0;
    display: none; /* hide the vertical line for the last chapter */
  }

  &.activeChapter .beforeCurrentTime:last-child {
    border-bottom-color: ${p => p.theme.tokens.border.accent.vibrant};
  }

  /* the border-top is used to eliminate some of the top gap */

  &:hover {
    border-top: 1px solid ${p => p.theme.tokens.background.secondary};
  }

  [data-is-feedback='true'] {
    &:hover {
      border-top: 1px solid ${p => p.theme.tokens.border.promotion.muted};
    }
  }

  [data-is-error='true'] {
    &:hover {
      border-top: 1px solid ${p => p.theme.tokens.border.danger.muted};
    }
  }
`;

const ChapterBreadcrumbRow = styled(BreadcrumbRow)`
  padding: ${space(0.5)} ${space(0.75)};

  &::before {
    display: none;
  }

  &:hover {
    background-color: ${p => p.theme.tokens.background.secondary};
  }
`;

const Chapter = styled('summary')`
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.lg};
  padding: 0 ${space(0.75)};
  color: ${p => p.theme.tokens.content.primary};

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

  [data-is-feedback='true'] & {
    color: ${p => p.theme.tokens.content.promotion};

    &:hover {
      background-color: ${p => p.theme.tokens.background.transparent.promotion.muted};
    }
  }

  [data-is-error='true'] & {
    color: ${p => p.theme.tokens.content.danger};

    &:hover {
      background-color: ${p => p.theme.tokens.background.transparent.danger.muted};
    }
  }
`;

const ChapterTitle = styled('div')`
  display: grid;
  grid-template-columns: auto auto;
  gap: ${space(1)};
  grid-template-areas: 'title timestamp';
  flex: 1;
  align-items: center;
  font-size: ${p => p.theme.fontSize.md};
  padding: ${space(1)} 0;

  .activeChapter & {
    font-weight: ${p => p.theme.fontWeight.bold};
  }

  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  margin-bottom: -1px; /* Compensate for border to fully eliminate gap */

  details:last-child:not([open]) & {
    border-bottom: none;
  }
`;

const ReplayTimestamp = styled('span')`
  display: flex;
  gap: ${space(0.5)};
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  justify-content: flex-end;
`;

const EmptyContainer = styled('div')`
  padding: ${space(2)};
`;
