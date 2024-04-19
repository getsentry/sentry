import type {CSSProperties, MouseEvent} from 'react';
import {isValidElement, memo} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Link from 'sentry/components/links/link';
import ObjectInspector from 'sentry/components/objectInspector';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import {OpenReplayComparisonButton} from 'sentry/components/replays/breadcrumbs/openReplayComparisonButton';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useReplayGroupContext} from 'sentry/components/replays/replayGroupContext';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import type {ErrorFrame, FeedbackFrame, ReplayFrame} from 'sentry/utils/replays/types';
import {isErrorFrame, isFeedbackFrame} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import IconWrapper from 'sentry/views/replays/detail/iconWrapper';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

type MouseCallback = (frame: ReplayFrame, e: React.MouseEvent<HTMLElement>) => void;

const FRAMES_WITH_BUTTONS = ['replay.hydrate-error'];

interface Props {
  extraction: Extraction | undefined;
  frame: ReplayFrame;
  onClick: null | MouseCallback;
  onInspectorExpanded: (
    path: string,
    expandedState: Record<string, boolean>,
    event: MouseEvent<HTMLDivElement>
  ) => void;
  onMouseEnter: MouseCallback;
  onMouseLeave: MouseCallback;
  startTimestampMs: number;
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
  onInspectorExpanded,
  onMouseEnter,
  onMouseLeave,
  startTimestampMs,
  style,
}: Props) {
  const {color, description, title, icon} = getFrameDetails(frame);
  const {replay} = useReplayContext();

  const forceSpan = 'category' in frame && FRAMES_WITH_BUTTONS.includes(frame.category);

  return (
    <CrumbItem
      data-is-error-frame={isErrorFrame(frame)}
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
          </Flex>

          {'data' in frame && frame.data && 'mutations' in frame.data ? (
            <div>
              <OpenReplayComparisonButton
                replay={replay}
                leftTimestamp={frame.offsetMs}
                rightTimestamp={
                  (frame.data.mutations.next?.timestamp ?? 0) -
                  (replay?.getReplay().started_at.getTime() ?? 0)
                }
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

          {isErrorFrame(frame) || isFeedbackFrame(frame) ? (
            <CrumbErrorIssue frame={frame} />
          ) : null}
        </CrumbDetails>
      </ErrorBoundary>
    </CrumbItem>
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

export default memo(BreadcrumbItem);
