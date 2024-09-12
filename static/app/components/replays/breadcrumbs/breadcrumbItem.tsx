import type {CSSProperties, ReactNode} from 'react';
import {isValidElement, memo, useCallback} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Flex} from 'sentry/components/container/flex';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Link from 'sentry/components/links/link';
import ObjectInspector from 'sentry/components/objectInspector';
import PanelItem from 'sentry/components/panels/panelItem';
import {OpenReplayComparisonButton} from 'sentry/components/replays/breadcrumbs/openReplayComparisonButton';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useReplayGroupContext} from 'sentry/components/replays/replayGroupContext';
import StructuredEventData from 'sentry/components/structuredEventData';
import Timeline from 'sentry/components/timeline';
import {useHasNewTimelineUI} from 'sentry/components/timeline/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Extraction} from 'sentry/utils/replays/extractHtml';
import {getReplayDiffOffsetsFromFrame} from 'sentry/utils/replays/getDiffTimestamps';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useExtractDomNodes from 'sentry/utils/replays/hooks/useExtractDomNodes';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {
  ErrorFrame,
  FeedbackFrame,
  HydrationErrorFrame,
  ReplayFrame,
  WebVitalFrame,
} from 'sentry/utils/replays/types';
import {
  isBreadcrumbFrame,
  isCLSFrame,
  isErrorFrame,
  isFeedbackFrame,
  isHydrationErrorFrame,
  isSpanFrame,
  isWebVitalFrame,
} from 'sentry/utils/replays/types';
import type {Color} from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import IconWrapper from 'sentry/views/replays/detail/iconWrapper';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

type MouseCallback = (frame: ReplayFrame, nodeId?: number) => void;

const FRAMES_WITH_BUTTONS = ['replay.hydrate-error'];

interface Props {
  frame: ReplayFrame;
  onClick: null | MouseCallback;
  onInspectorExpanded: (path: string, expandedState: Record<string, boolean>) => void;
  onMouseEnter: MouseCallback;
  onMouseLeave: MouseCallback;
  startTimestampMs: number;
  className?: string;
  expandPaths?: string[];
  extraction?: Extraction;
  style?: CSSProperties;
}

function BreadcrumbItem({
  className,
  extraction,
  frame,
  expandPaths,
  onClick,
  onInspectorExpanded,
  onMouseEnter,
  onMouseLeave,
  startTimestampMs,
  style,
}: Props) {
  const {color, description, title, icon} = getFrameDetails(frame);
  const {replay} = useReplayContext();

  const forceSpan = 'category' in frame && FRAMES_WITH_BUTTONS.includes(frame.category);

  const renderDescription = useCallback(() => {
    return typeof description === 'string' ||
      (description !== undefined && isValidElement(description)) ? (
      <Description title={description} showOnlyOnOverflow isHoverable>
        {description}
      </Description>
    ) : (
      <InspectorWrapper>
        <ObjectInspector
          data={description}
          expandPaths={expandPaths}
          onExpand={onInspectorExpanded}
          theme={{
            TREENODE_FONT_SIZE: '0.7rem',
            ARROW_FONT_SIZE: '0.5rem',
          }}
        />
      </InspectorWrapper>
    );
  }, [description, expandPaths, onInspectorExpanded]);

  const renderComparisonButton = useCallback(() => {
    return isBreadcrumbFrame(frame) && isHydrationErrorFrame(frame) ? (
      <CrumbHydrationButton replay={replay} frame={frame} />
    ) : null;
  }, [frame, replay]);

  const renderWebVital = useCallback(() => {
    return isSpanFrame(frame) && isWebVitalFrame(frame) ? (
      <WebVitalData
        replay={replay}
        frame={frame}
        expandPaths={expandPaths}
        onInspectorExpanded={onInspectorExpanded}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    ) : null;
  }, [expandPaths, frame, onInspectorExpanded, onMouseEnter, onMouseLeave, replay]);

  const renderCodeSnippet = useCallback(() => {
    return (
      (!isSpanFrame(frame) || !isWebVitalFrame(frame)) &&
      extraction?.html?.map(html => (
        <CodeContainer key={html}>
          <CodeSnippet language="html" hideCopyButton>
            {beautify.html(html, {indent_size: 2})}
          </CodeSnippet>
        </CodeContainer>
      ))
    );
  }, [extraction?.html, frame]);

  const renderIssueLink = useCallback(() => {
    return isErrorFrame(frame) || isFeedbackFrame(frame) ? (
      <CrumbErrorIssue frame={frame} />
    ) : null;
  }, [frame]);

  const hasNewTimelineUI = useHasNewTimelineUI();
  if (hasNewTimelineUI) {
    // Coerce previous design colors into new ones. After 'new-timeline-ui' is GA, we can modify
    // the mapper directly.
    const darkColor =
      color === 'gray300' ? color : (color.replace('300', '400') as Color);
    return (
      <StyledTimelineItem
        icon={icon}
        title={title}
        colorConfig={{title: darkColor, icon: darkColor, iconBorder: color}}
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
          {renderDescription()}
          {renderComparisonButton()}
          {renderWebVital()}
          {renderCodeSnippet()}
          {renderIssueLink()}
        </ErrorBoundary>
      </StyledTimelineItem>
    );
  }
  return (
    <CrumbItem
      data-is-error-frame={isErrorFrame(frame)}
      as={onClick && !forceSpan ? 'button' : 'span'}
      onClick={event => {
        event.stopPropagation();
        onClick?.(frame);
      }}
      onMouseEnter={() => onMouseEnter(frame)}
      onMouseLeave={() => onMouseLeave(frame)}
      style={style}
      className={className}
    >
      <IconWrapper color={color} hasOccurred>
        {icon}
      </IconWrapper>
      <ErrorBoundary mini>
        <CrumbDetails>
          <Flex column>
            <TitleContainer>
              {<Title>{title}</Title>}
              {onClick ? (
                <TimestampButton
                  startTimestampMs={startTimestampMs}
                  timestampMs={frame.timestampMs}
                />
              ) : null}
            </TitleContainer>
            {renderDescription()}
          </Flex>
          {renderComparisonButton()}
          {renderWebVital()}
          {renderCodeSnippet()}
          {renderIssueLink()}
        </CrumbDetails>
      </ErrorBoundary>
    </CrumbItem>
  );
}

function WebVitalData({
  replay,
  frame,
  expandPaths,
  onInspectorExpanded,
  onMouseEnter,
  onMouseLeave,
}: {
  expandPaths: string[] | undefined;
  frame: WebVitalFrame;
  onInspectorExpanded: (path: string, expandedState: Record<string, boolean>) => void;
  onMouseEnter: MouseCallback;
  onMouseLeave: MouseCallback;
  replay: ReplayReader | null;
}) {
  const {data: frameToExtraction} = useExtractDomNodes({replay});
  const selectors = frameToExtraction?.get(frame)?.selectors;

  const webVitalData = {value: frame.data.value};
  if (isCLSFrame(frame) && frame.data.attributions && selectors) {
    const layoutShifts: {[x: string]: ReactNode[]}[] = [];
    for (const attr of frame.data.attributions) {
      const elements: ReactNode[] = [];
      if ('nodeIds' in attr && Array.isArray(attr.nodeIds)) {
        attr.nodeIds.forEach(nodeId => {
          selectors.get(nodeId)
            ? elements.push(
                <span
                  key={nodeId}
                  onMouseEnter={() => onMouseEnter(frame, nodeId)}
                  onMouseLeave={() => onMouseLeave(frame, nodeId)}
                >
                  <ValueObjectKey>{t('element')}</ValueObjectKey>
                  <span>{': '}</span>
                  <span>
                    <SelectorButton>{selectors.get(nodeId)}</SelectorButton>
                  </span>
                </span>
              )
            : null;
        });
      }
      // if we can't find the elements associated with the layout shift, we still show the score with element: unknown
      if (!elements.length) {
        elements.push(
          <span>
            <ValueObjectKey>{t('element')}</ValueObjectKey>
            <span>{': '}</span>
            <ValueNull>{t('unknown')}</ValueNull>
          </span>
        );
      }
      layoutShifts.push({[`score ${attr.value}`]: elements});
    }
    if (layoutShifts.length) {
      webVitalData['Layout shifts'] = layoutShifts;
    }
  } else if (selectors?.size) {
    selectors.forEach((key, value) => {
      webVitalData[key] = (
        <span
          key={key}
          onMouseEnter={() => onMouseEnter(frame, value)}
          onMouseLeave={() => onMouseLeave(frame, value)}
        >
          <ValueObjectKey>{t('element')}</ValueObjectKey>
          <span>{': '}</span>
          <SelectorButton size="zero" borderless>
            {key}
          </SelectorButton>
        </span>
      );
    });
  }

  return (
    <StructuredEventData
      initialExpandedPaths={expandPaths ?? []}
      onToggleExpand={(expandedPaths, path) => {
        onInspectorExpanded(
          path,
          Object.fromEntries(expandedPaths.map(item => [item, true]))
        );
      }}
      data={webVitalData}
      withAnnotatedText
    />
  );
}

function CrumbHydrationButton({
  replay,
  frame,
}: {
  frame: HydrationErrorFrame;
  replay: ReplayReader | null;
}) {
  const {leftOffsetMs, rightOffsetMs} = getReplayDiffOffsetsFromFrame(replay, frame);

  return (
    <div>
      <OpenReplayComparisonButton
        replay={replay}
        leftOffsetMs={leftOffsetMs}
        rightOffsetMs={rightOffsetMs}
        surface="replay-breadcrumbs"
        size="xs"
      >
        {t('Open Hydration Diff')}
      </OpenReplayComparisonButton>
    </div>
  );
}

function CrumbErrorIssue({frame}: {frame: FeedbackFrame | ErrorFrame}) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug: frame.data.projectSlug});
  const {groupId} = useReplayGroupContext();

  const projectAvatar = project ? <ProjectAvatar project={project} size={16} /> : null;

  if (String(frame.data.groupId) === groupId) {
    return (
      <CrumbIssueWrapper>
        {projectAvatar}
        {frame.data.groupShortId}
      </CrumbIssueWrapper>
    );
  }

  return (
    <CrumbIssueWrapper>
      {projectAvatar}
      <Link
        to={
          isFeedbackFrame(frame)
            ? {
                pathname: `/organizations/${organization.slug}/feedback/`,
                query: {feedbackSlug: `${frame.data.projectSlug}:${frame.data.groupId}`},
              }
            : `/organizations/${organization.slug}/issues/${frame.data.groupId}/`
        }
      >
        {frame.data.groupShortId}
      </Link>
    </CrumbIssueWrapper>
  );
}

const CrumbIssueWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const InspectorWrapper = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
`;

const CrumbDetails = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: ${space(0.5)};
`;

const TitleContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Title = styled('span')`
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.gray400};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const Description = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const StyledTimelineItem = styled(Timeline.Item)`
  width: 100%;
  position: relative;
  padding: ${space(0.5)} ${space(0.75)};
  margin: 0;
  &:hover {
    background: ${p => p.theme.translucentSurface200};
    .icon-wrapper {
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
  font-size: ${p => p.theme.fontSizeSmall};
  align-self: flex-start;
`;

const CrumbItem = styled(PanelItem)<{isErrorFrame?: boolean}>`
  display: grid;
  grid-template-columns: max-content auto;
  align-items: flex-start;
  gap: ${space(1)};
  width: 100%;

  font-size: ${p => p.theme.fontSizeMedium};
  background: transparent;
  [data-is-error-frame='true'] {
    background: ${p => p.theme.red100};
  }
  padding: ${space(1)};
  text-align: left;
  border: none;
  position: relative;

  &:hover {
    background: ${p => p.theme.surface200};
  }

  /* Draw a vertical line behind the breadcrumb icon. The line connects each row together, but is truncated for the first and last items */
  &::after {
    content: '';
    position: absolute;
    left: 19.5px;
    width: 1px;
    background: ${p => p.theme.gray200};
    top: -1px;
    bottom: -1px;
  }

  &:first-of-type::after {
    top: ${space(1)};
    bottom: -1px;
  }

  &:last-of-type::after {
    top: -1px;
    bottom: calc(100% - ${space(1)});
  }

  &:only-of-type::after {
    display: none;
  }
`;

const CodeContainer = styled('div')`
  max-height: 400px;
  max-width: 100%;
  overflow: auto;
`;

const ValueObjectKey = styled('span')`
  color: var(--prism-keyword);
`;

const ValueNull = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
  color: var(--prism-property);
`;

const SelectorButton = styled(Button)`
  background: none;
  border: none;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: ${p => p.theme.fontWeightNormal};
  box-shadow: none;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin: 0 ${space(0.5)};
  height: auto;
  min-height: auto;
`;

export default memo(BreadcrumbItem);
