import {useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {OpenInContextLine} from 'sentry/components/events/interfaces/frame/openInContextLine';
import {StacktraceLink} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import {
  getLeadHint,
  getPlatform,
  isDotnet,
  trimPackage,
} from 'sentry/components/events/interfaces/frame/utils';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconChevron, IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Frame} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import useProjects from 'sentry/utils/useProjects';

const LONG_PATH_BREAK_THRESHOLD = 80;
const HOVER_ACTIONS_SLOT_WIDTH = 'clamp(160px, 18vw, 220px)';
const HOVER_ACTIONS_SLOT_HEIGHT = 24;
const STACKTRACE_INTERACTIVE_SELECTOR = '[data-stacktrace-interactive="true"]';

function isInteractiveClickTarget(target: EventTarget | null): boolean {
  if (target instanceof Element) {
    return !!target.closest(STACKTRACE_INTERACTIVE_SELECTOR);
  }

  if (target instanceof Node) {
    return !!target.parentElement?.closest(STACKTRACE_INTERACTIVE_SELECTOR);
  }

  return false;
}

function getFrameDisplayPath(frame: Frame, platform: PlatformKey) {
  const framePlatform = getPlatform(frame.platform, platform);

  if (framePlatform === 'java') {
    return frame.module ?? frame.filename ?? '';
  }

  return frame.filename ?? frame.module ?? '';
}

export function FrameHeader() {
  const [isHovering, setIsHovering] = useState(false);
  const {
    event,
    frame,
    hiddenFrameCount,
    hiddenFramesExpanded,
    isExpandable,
    isExpanded,
    nextFrame,
    platform,
    timesRepeated,
    toggleExpansion,
    toggleHiddenFrames,
  } = useStackTraceFrameContext();
  const {components} = useStackTraceContext();
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(candidate => candidate.id === event.projectID),
    [event.projectID, projects]
  );
  const leadsToApp = !frame.inApp && (nextFrame?.inApp || !nextFrame);
  const frameDisplayPath = getFrameDisplayPath(frame, platform);
  const frameFunctionName = frame.function ?? frame.rawFunction;
  const hasFrameFunction = !!frameFunctionName;
  const framePlatform = getPlatform(frame.platform, platform);
  const showPackage = !!frame.package && !isDotnet(framePlatform);
  const shouldTruncateFilenameLeft = frameDisplayPath.length >= LONG_PATH_BREAK_THRESHOLD;
  const shouldBreakFrameMetaLine =
    frameDisplayPath.length >= LONG_PATH_BREAK_THRESHOLD &&
    (hasFrameFunction || frame.lineNo !== undefined || showPackage);
  const framePathTooltip =
    frame.absPath && frame.absPath !== frameDisplayPath ? frame.absPath : undefined;
  const contextLine = frame.context?.find(([lineNumber]) => lineNumber === frame.lineNo);
  const frameCanShowActions =
    !!frame.filename && (frame.inApp || event.platform === 'csharp');
  const canShowFrameActions = frameCanShowActions && (isExpanded || isHovering);
  const showCodeMappingLink = canShowFrameActions && !!project;
  const showSentryAppStacktraceLink = canShowFrameActions && components.length > 0;

  return (
    <FrameHeaderContainer
      data-test-id="core-stacktrace-frame-title"
      isExpandable={isExpandable}
      role={isExpandable ? 'button' : undefined}
      aria-expanded={isExpandable ? isExpanded : undefined}
      tabIndex={isExpandable ? 0 : -1}
      onClick={mouseEvent => {
        if (!isExpandable || isInteractiveClickTarget(mouseEvent.target)) {
          return;
        }

        toggleExpansion();
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onKeyDown={keyboardEvent => {
        if (!isExpandable) {
          return;
        }

        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
          keyboardEvent.preventDefault();
          toggleExpansion();
        }
      }}
    >
      <FrameHeaderMain direction="column" align="start" flex="1" gap="2xs" minWidth={0}>
        <FrameTitle>
          {!isExpanded && leadsToApp ? (
            <FrameLeadHint as="span" size="xs" variant="muted">
              {getLeadHint({event, hasNextFrame: !!nextFrame})}
              {': '}
            </FrameLeadHint>
          ) : null}
          <Tooltip title={framePathTooltip} disabled={!framePathTooltip} maxWidth={750}>
            <FrameTitleFilename
              data-test-id="filename"
              data-truncate-left={shouldTruncateFilenameLeft}
              truncateLeft={shouldTruncateFilenameLeft}
            >
              <span>{frameDisplayPath}</span>
            </FrameTitleFilename>
          </Tooltip>
          <FrameTitleMeta
            data-test-id="core-stacktrace-frame-meta"
            data-force-newline={shouldBreakFrameMetaLine}
            forceNewLine={shouldBreakFrameMetaLine}
          >
            {hasFrameFunction ? (
              <FrameTitleHint as="span" size="sm" variant="muted">
                {`${t('in')} `}
              </FrameTitleHint>
            ) : null}
            {hasFrameFunction ? (
              <FrameTitleFunction data-test-id="function">
                {frameFunctionName}
              </FrameTitleFunction>
            ) : null}
            {frame.lineNo ? (
              <FrameLineMeta>
                <FrameTitleHint as="span" size="sm" variant="muted">
                  {`${t('at line')} `}
                </FrameTitleHint>
                <FrameTitleName>
                  {frame.colNo ? `${frame.lineNo}:${frame.colNo}` : frame.lineNo}
                </FrameTitleName>
              </FrameLineMeta>
            ) : null}
            {showPackage ? (
              <FrameLineMeta>
                <FrameTitleHint as="span" size="sm" variant="muted">
                  {`${t('within')} `}
                </FrameTitleHint>
                <FrameTitleName>{trimPackage(frame.package ?? '')}</FrameTitleName>
              </FrameLineMeta>
            ) : null}
          </FrameTitleMeta>
        </FrameTitle>
      </FrameHeaderMain>

      <FrameHeaderRight gap="xs" align="center">
        {frame.inApp ? null : <Tag variant="muted">{t('System')}</Tag>}
        <RepeatsIndicator timesRepeated={timesRepeated} />

        <FrameHeaderTrailing
          data-test-id="core-stacktrace-frame-trailing"
          gap="xs"
          align="center"
        >
          <FrameActions
            reserveSpace={frameCanShowActions}
            data-test-id="core-stacktrace-frame-actions-slot"
          >
            {showCodeMappingLink ? (
              <span data-stacktrace-interactive="true">
                <StacktraceLink
                  frame={frame}
                  line={contextLine?.[1] ?? ''}
                  event={event}
                  disableSetup={false}
                />
              </span>
            ) : null}

            {showSentryAppStacktraceLink ? (
              <span data-stacktrace-interactive="true">
                <OpenInContextLine
                  lineNo={frame.lineNo ?? null}
                  filename={frame.filename ?? ''}
                  components={components}
                />
              </span>
            ) : null}
          </FrameActions>

          {hiddenFrameCount ? (
            <Button
              size="zero"
              priority="transparent"
              data-stacktrace-interactive="true"
              onClick={() => toggleHiddenFrames()}
            >
              {hiddenFramesExpanded
                ? t('Hide %s frames', hiddenFrameCount)
                : t('Show %s more frames', hiddenFrameCount)}
            </Button>
          ) : null}

          {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}

          {isExpandable ? (
            <ChevronToggle
              type="button"
              aria-label={isExpanded ? t('Collapse frame') : t('Expand frame')}
              data-test-id="core-stacktrace-chevron-toggle"
              data-stacktrace-interactive="true"
              onClick={() => toggleExpansion()}
            >
              <IconChevron direction={isExpanded ? 'down' : 'right'} size="xs" />
            </ChevronToggle>
          ) : null}
        </FrameHeaderTrailing>
      </FrameHeaderRight>
    </FrameHeaderContainer>
  );
}

function RepeatsIndicator({timesRepeated}: {timesRepeated: number}) {
  if (timesRepeated <= 0) {
    return null;
  }

  return (
    <RepeatedFrames
      data-test-id="core-stacktrace-repeats-indicator"
      title={tn('Frame repeated %s time', 'Frame repeated %s times', timesRepeated)}
    >
      <RepeatedContent>
        <IconRefresh size="xs" />
        <span>{timesRepeated}</span>
      </RepeatedContent>
    </RepeatedFrames>
  );
}

const FrameHeaderContainer = styled(Flex)<{isExpandable: boolean}>`
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.sm};
  width: 100%;
  cursor: ${p => (p.isExpandable ? 'pointer' : 'default')};
  text-align: left;
  padding: ${p => `${p.theme.space.md} ${p.theme.space.md}`};
  background: ${p => p.theme.tokens.background.tertiary};

  &:focus-visible {
    ${p => p.theme.focusRing()}
  }

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-wrap: wrap;
    align-items: flex-start;
  }
`;

const FrameHeaderMain = styled(Flex)`
  min-width: 0;
`;

const FrameHeaderRight = styled(Flex)`
  min-width: 0;
  flex-shrink: 0;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    width: 100%;
    justify-content: flex-start;
    align-items: center;
    flex-wrap: wrap;
    row-gap: ${p => p.theme.space.xs};
  }
`;

const FrameHeaderTrailing = styled(Flex)`
  min-width: 0;
  margin-left: auto;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    width: 100%;
    justify-content: flex-end;
  }
`;

const ChevronToggle = styled('button')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  border: 0;
  border-radius: ${p => p.theme.radius.md};
  background: transparent;
  color: inherit;
  padding: 0;
  margin: 0;
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  pointer-events: auto;

  svg {
    pointer-events: none;
  }
`;

const FrameActions = styled(Flex)<{reserveSpace: boolean}>`
  align-items: center;
  gap: ${p => p.theme.space.sm};
  justify-content: flex-end;
  width: ${p => (p.reserveSpace ? HOVER_ACTIONS_SLOT_WIDTH : '0')};
  flex: ${p => (p.reserveSpace ? `0 0 ${HOVER_ACTIONS_SLOT_WIDTH}` : '0 0 0')};
  height: ${p => (p.reserveSpace ? `${HOVER_ACTIONS_SLOT_HEIGHT}px` : '0')};
  min-height: ${p => (p.reserveSpace ? `${HOVER_ACTIONS_SLOT_HEIGHT}px` : '0')};
  overflow: hidden;
  white-space: nowrap;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    width: auto;
    flex: 0 1 auto;
    height: auto;
    min-height: 0;
    overflow: visible;
  }
`;

const RepeatedFrames = styled(Flex)`
  display: inline-flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
`;

const RepeatedContent = styled(Flex)`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.sm};
`;

const FrameTitle = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.45;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  overflow-wrap: normal;
`;

const FrameTitleMeta = styled('span')<{forceNewLine: boolean}>`
  display: inline-flex;
  align-items: baseline;
  max-width: 100%;
  min-width: 0;
  margin-left: ${p => p.theme.space.xs};
  white-space: nowrap;

  ${p =>
    p.forceNewLine &&
    css`
      display: flex;
      width: 100%;
      margin-left: 0;
      margin-top: 0;
    `}
`;

const FrameTitleHint = styled(Text)`
  font-family: inherit;
  line-height: inherit;
`;

const FrameLeadHint = styled(Text)`
  font-family: inherit;
  line-height: inherit;
  font-style: italic;
  opacity: 0.8;
`;

const FrameTitleName = styled('code')`
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
`;

const FrameTitleFunction = styled(FrameTitleName)`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FrameLineMeta = styled('span')`
  display: inline-flex;
  align-items: baseline;
  flex-shrink: 0;
  margin-left: ${p => p.theme.space.xs};
  white-space: nowrap;
`;

const FrameTitleFilename = styled(FrameTitleName)<{truncateLeft: boolean}>`
  display: inline-block;
  max-width: 100%;

  > span {
    direction: ltr;
    unicode-bidi: isolate;
  }

  ${p =>
    p.truncateLeft &&
    css`
      display: block;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      direction: rtl;
      text-align: left;
    `}
`;
