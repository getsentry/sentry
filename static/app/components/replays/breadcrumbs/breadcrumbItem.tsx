import type {CSSProperties, MouseEvent} from 'react';
import {isValidElement, memo} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import ObjectInspector from 'sentry/components/objectInspector';
import PanelItem from 'sentry/components/panels/panelItem';
import OpenFeedbackButton from 'sentry/components/replays/breadcrumbs/openFeedbackButton';
import {OpenReplayComparisonButton} from 'sentry/components/replays/breadcrumbs/openReplayComparisonButton';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useReplayGroupContext} from 'sentry/components/replays/replayGroupContext';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {getShortEventId} from 'sentry/utils/events';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import type {ErrorFrame, ReplayFrame} from 'sentry/utils/replays/types';
import {isErrorFrame} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import IconWrapper from 'sentry/views/replays/detail/iconWrapper';
import TraceGrid from 'sentry/views/replays/detail/perfTable/traceGrid';
import type {ReplayTraceRow} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

type MouseCallback = (frame: ReplayFrame, e: React.MouseEvent<HTMLElement>) => void;

const FRAMES_WITH_BUTTONS = ['replay.hydrate-error', 'sentry.feedback'];

interface Props {
  extraction: Extraction | undefined;
  frame: ReplayFrame;
  onClick: null | MouseCallback;
  onDimensionChange: () => void;
  onInspectorExpanded: (
    path: string,
    expandedState: Record<string, boolean>,
    event: MouseEvent<HTMLDivElement>
  ) => void;
  onMouseEnter: MouseCallback;
  onMouseLeave: MouseCallback;
  projectSlug: string | undefined;
  startTimestampMs: number;
  traces: ReplayTraceRow | undefined;
  className?: string;
  expandPaths?: string[];
  style?: CSSProperties;
}

function BreadcrumbItem({
  className,
  extraction,
  frame,
  expandPaths,
  onClick,
  onDimensionChange,
  onInspectorExpanded,
  onMouseEnter,
  onMouseLeave,
  projectSlug,
  startTimestampMs,
  style,
  traces,
}: Props) {
  const {color, description, title, icon} = getFrameDetails(frame);
  const {replay} = useReplayContext();

  const forceSpan = 'category' in frame && FRAMES_WITH_BUTTONS.includes(frame.category);

  return (
    <CrumbItem
      as={onClick && !forceSpan ? 'button' : 'span'}
      onClick={e => onClick?.(frame, e)}
      onMouseEnter={e => onMouseEnter(frame, e)}
      onMouseLeave={e => onMouseLeave(frame, e)}
      style={style}
      className={className}
    >
      <IconWrapper color={color} hasOccurred>
        {icon}
      </IconWrapper>
      <CrumbDetails>
        <TitleContainer>
          {isErrorFrame(frame) ? (
            <CrumbErrorTitle frame={frame} />
          ) : (
            <Title>{title}</Title>
          )}
          {onClick ? (
            <TimestampButton
              startTimestampMs={startTimestampMs}
              timestampMs={frame.timestampMs}
            />
          ) : null}
        </TitleContainer>

        {typeof description === 'string' ||
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
        )}

        {'data' in frame && frame.data && 'mutations' in frame.data ? (
          <div>
            <OpenReplayComparisonButton
              replay={replay}
              leftTimestamp={frame.offsetMs}
              rightTimestamp={
                (frame.data.mutations.next.timestamp as number) -
                (replay?.getReplay().started_at.getTime() ?? 0)
              }
            />
          </div>
        ) : null}

        {projectSlug && 'data' in frame && frame.data && 'feedbackId' in frame.data ? (
          <div>
            <OpenFeedbackButton
              projectSlug={projectSlug}
              eventId={frame.data.feedbackId}
            />
          </div>
        ) : null}

        {extraction?.html ? (
          <CodeContainer>
            <CodeSnippet language="html" hideCopyButton>
              {beautify.html(extraction?.html, {indent_size: 2})}
            </CodeSnippet>
          </CodeContainer>
        ) : null}

        {traces?.flattenedTraces.map((flatTrace, i) => (
          <TraceGrid
            key={i}
            flattenedTrace={flatTrace}
            onDimensionChange={onDimensionChange}
          />
        ))}

        {isErrorFrame(frame) ? <CrumbErrorIssue frame={frame} /> : null}
      </CrumbDetails>
    </CrumbItem>
  );
}

function CrumbErrorTitle({frame}: {frame: ErrorFrame}) {
  const organization = useOrganization();
  const {eventId} = useReplayGroupContext();

  if (eventId === frame.data.eventId) {
    return <Title>Error: This Event</Title>;
  }

  return (
    <Title>
      Error:{' '}
      <Link
        to={`/organizations/${organization.slug}/issues/${frame.data.groupId}/events/${frame.data.eventId}/#replay`}
      >
        {getShortEventId(frame.data.eventId)}
      </Link>
    </Title>
  );
}

function CrumbErrorIssue({frame}: {frame: ErrorFrame}) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug: frame.data.projectSlug});
  const {groupId} = useReplayGroupContext();

  const projectBadge = project ? (
    <ProjectBadge project={project} avatarSize={16} disableLink displayName={false} />
  ) : null;

  if (`${frame.data.groupId}` === groupId) {
    return (
      <CrumbIssueWrapper>
        {projectBadge}
        {frame.data.groupShortId}
      </CrumbIssueWrapper>
    );
  }

  return (
    <CrumbIssueWrapper>
      {projectBadge}
      <Link to={`/organizations/${organization.slug}/issues/${frame.data.groupId}/`}>
        {frame.data.groupShortId}
      </Link>
    </CrumbIssueWrapper>
  );
}

const CrumbIssueWrapper = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
`;

const InspectorWrapper = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
`;

const CrumbDetails = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  font-weight: 600;
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

const CrumbItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: max-content auto;
  align-items: flex-start;
  gap: ${space(1)};
  width: 100%;

  font-size: ${p => p.theme.fontSizeMedium};
  background: transparent;
  padding: ${space(1)};
  text-align: left;
  border: none;
  position: relative;

  border-radius: ${p => p.theme.borderRadius};

  &:hover {
    background-color: ${p => p.theme.surface200};
  }

  /* Draw a vertical line behind the breadcrumb icon. The line connects each row together, but is truncated for the first and last items */
  &::after {
    content: '';
    position: absolute;
    left: 19.5px;
    width: 1px;
    background: ${p => p.theme.gray200};
    height: 100%;
  }

  &:first-of-type::after {
    top: ${space(1)};
    bottom: 0;
  }

  &:last-of-type::after {
    top: 0;
    height: ${space(1)};
  }

  &:only-of-type::after {
    height: 0;
  }
`;

const CodeContainer = styled('div')`
  margin-top: ${space(1)};
  max-height: 400px;
  max-width: 100%;
  overflow: auto;
`;

export default memo(BreadcrumbItem);
