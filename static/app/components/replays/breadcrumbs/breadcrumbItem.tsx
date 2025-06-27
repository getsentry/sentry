import type {CSSProperties} from 'react';
import {useCallback, useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {BreadcrumbCodeSnippet} from 'sentry/components/replays/breadcrumbs/breadcrumbCodeSnippet';
import {BreadcrumbComparisonButton} from 'sentry/components/replays/breadcrumbs/breadcrumbComparisonButton';
import {BreadcrumbDescription} from 'sentry/components/replays/breadcrumbs/breadcrumbDescription';
import {BreadcrumbIssueLink} from 'sentry/components/replays/breadcrumbs/breadcrumbIssueLink';
import {BreadcrumbWebVital} from 'sentry/components/replays/breadcrumbs/breadcrumbWebVital';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Timeline} from 'sentry/components/timeline';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useExtractDomNodes from 'sentry/utils/replays/hooks/useExtractDomNodes';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {isErrorFrame} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';
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

function BreadcrumbItem({
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
  const {replay} = useReplayContext();
  const organization = useOrganization();
  const {data: extraction, isPending} = useExtractDomNodes({
    replay,
    frame,
    enabled: showSnippet,
  });

  const prevExtractState = useRef(isPending);

  useEffect(() => {
    if (!updateDimensions) {
      return;
    }

    if (isPending !== prevExtractState.current || showSnippet) {
      prevExtractState.current = isPending;
      updateDimensions();
    }
  }, [isPending, updateDimensions, showSnippet]);

  const handleViewHtml = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onShowSnippet();
      e.preventDefault();
      e.stopPropagation();
      trackAnalytics('replay.view-html', {
        organization,
        breadcrumb_type: 'category' in frame ? frame.category : 'unknown',
      });
    },
    [onShowSnippet, organization, frame]
  );

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
        <BreadcrumbDescription
          description={description}
          frame={frame}
          allowShowSnippet={allowShowSnippet}
          showSnippet={showSnippet}
          onClickViewHtml={handleViewHtml}
          expandPaths={expandPaths}
          onInspectorExpanded={onInspectorExpanded}
        />
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
    background: ${p => p.theme.translucentSurface200};
    .timeline-icon-wrapper {
      background: ${p => p.theme.translucentSurface200};
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
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.sm};
  align-self: flex-start;
`;

export default BreadcrumbItem;
