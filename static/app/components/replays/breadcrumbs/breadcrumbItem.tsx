import type {CSSProperties} from 'react';
import {isValidElement, useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {BreadcrumbCodeSnippet} from 'sentry/components/replays/breadcrumbs/breadcrumbCodeSnippet';
import {BreadcrumbComparisonButton} from 'sentry/components/replays/breadcrumbs/breadcrumbComparisonButton';
import {BreadcrumbDescription} from 'sentry/components/replays/breadcrumbs/breadcrumbDescription';
import {BreadcrumbIssueLink} from 'sentry/components/replays/breadcrumbs/breadcrumbIssueLink';
import {BreadcrumbStructuredData} from 'sentry/components/replays/breadcrumbs/breadcrumbStructuredData';
import {BreadcrumbWebVital} from 'sentry/components/replays/breadcrumbs/breadcrumbWebVital';
import {Timeline} from 'sentry/components/timeline';
import {space} from 'sentry/styles/space';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useExtractDomNodes from 'sentry/utils/replays/hooks/useExtractDomNodes';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {isErrorFrame} from 'sentry/utils/replays/types';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import type {OnExpandCallback} from 'sentry/views/replays/detail/useVirtualizedInspector';

type MouseCallback = (frame: ReplayFrame, nodeId?: number) => void;

interface Props {
  allowShowSnippet: boolean;
  frame: ReplayFrame;
  onClick: null | MouseCallback;
  onInspectorExpanded: OnExpandCallback;
  onMouseEnter: MouseCallback;
  onMouseLeave: MouseCallback;
  onShowSnippet: () => void;
  showSnippet: boolean;
  startTimestampMs: number;
  className?: string;
  expandPaths?: string[];
  extraction?: Extraction;
  ref?: React.Ref<HTMLDivElement>;
  style?: CSSProperties;
  updateDimensions?: () => void;
}

export default function BreadcrumbItem({
  className,
  frame,
  expandPaths,
  onClick,
  onInspectorExpanded,
  onMouseEnter,
  onMouseLeave,
  showSnippet,
  startTimestampMs,
  style,
  ref,
  onShowSnippet,
  updateDimensions,
  allowShowSnippet,
}: Props) {
  const theme = useTheme();
  const {colorGraphicsToken, description, title, icon} = getFrameDetails(frame);
  const colorHex = theme.tokens.graphics[colorGraphicsToken];
  const replay = useReplayReader();
  const {data: extraction, isPending} = useExtractDomNodes({
    replay,
    frame,
    enabled: showSnippet,
  });

  const prevExtractState = useRef(isPending);
  const prevShowSnippet = useRef(showSnippet);

  useEffect(() => {
    if (!updateDimensions) {
      return;
    }

    if (
      isPending !== prevExtractState.current ||
      (showSnippet && prevShowSnippet.current !== showSnippet)
    ) {
      prevExtractState.current = isPending;
      // We want/need to only re-render once when showSnippet is initially toggled,
      // otherwise can potentially trigger an infinite re-render.
      prevShowSnippet.current = showSnippet;
      updateDimensions();
    }
  }, [isPending, updateDimensions, showSnippet]);

  return (
    <StyledTimelineItem
      ref={ref}
      icon={icon}
      title={title}
      colorConfig={{title: colorHex, icon: colorHex, iconBorder: colorHex}}
      timestamp={
        <ReplayTimestamp>
          <TimestampButton
            startTimestampMs={startTimestampMs}
            timestampMs={frame.timestampMs}
          />
        </ReplayTimestamp>
      }
      data-is-error-frame={isErrorFrame(frame)}
      style={style}
      className={className}
      onClick={event => {
        event.stopPropagation();
        onClick?.(frame);
      }}
      onMouseEnter={() => onMouseEnter(frame)}
      onMouseLeave={() => onMouseLeave(frame)}
    >
      <ErrorBoundary mini>
        {typeof description === 'string' ||
        (description !== undefined && isValidElement(description)) ? (
          <BreadcrumbDescription
            description={description}
            frame={frame}
            allowShowSnippet={allowShowSnippet}
            showSnippet={showSnippet}
            onShowSnippet={onShowSnippet}
          />
        ) : (
          <BreadcrumbStructuredData
            description={description}
            expandPaths={expandPaths}
            onInspectorExpanded={onInspectorExpanded}
          />
        )}
        <BreadcrumbComparisonButton frame={frame} replay={replay} />
        <BreadcrumbWebVital
          frame={frame}
          extraction={extraction || undefined}
          expandPaths={expandPaths}
          onInspectorExpanded={onInspectorExpanded}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
        <BreadcrumbCodeSnippet
          frame={frame}
          extraction={extraction || undefined}
          showSnippet={showSnippet}
          isPending={isPending}
        />
        <BreadcrumbIssueLink frame={frame} />
      </ErrorBoundary>
    </StyledTimelineItem>
  );
}

const StyledTimelineItem = styled(Timeline.Item)`
  width: 100%;
  position: relative;
  padding: ${space(0.5)} ${space(0.75)};
  margin: 0;
  &:hover {
    background: ${p => p.theme.colors.surface200};
    .timeline-icon-wrapper {
      background: ${p => p.theme.colors.surface200};
    }
  }
  cursor: pointer;
  /* vertical line connecting items */
  &:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 16.5px;
    width: 1px;
    top: -2px;
    bottom: -9px;
    background: ${p => p.theme.border};
    z-index: 0;
  }
  &:first-child::before {
    top: 4px;
  }
`;

const ReplayTimestamp = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.sm};
  align-self: flex-start;
`;
