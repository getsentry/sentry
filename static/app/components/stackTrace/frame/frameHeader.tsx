import {useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  getLeadHint,
  getPlatform,
  isDotnet,
} from 'sentry/components/events/interfaces/frame/utils';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconQuestion, IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Frame} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';

function getFrameDisplayPath(frame: Frame, platform: PlatformKey) {
  const framePlatform = getPlatform(frame.platform, platform);

  if (framePlatform === 'java') {
    return frame.module ?? frame.filename ?? '';
  }

  return frame.filename ?? frame.module ?? '';
}

interface FrameHeaderProps {
  /**
   * Custom trailing actions for this frame. Pass a ReactNode, or a render
   * function that receives `isHovering`.
   */
  actions?: React.ReactNode | ((props: {isHovering: boolean}) => React.ReactNode);
}

export function FrameHeader({actions}: FrameHeaderProps) {
  const [isHovering, setIsHovering] = useState(false);
  const {
    event,
    frame,
    frameContextId,
    isExpandable,
    isExpanded,
    nextFrame,
    platform,
    timesRepeated,
    toggleExpansion,
  } = useStackTraceFrameContext();
  const {frameBadge} = useStackTraceContext();
  const leadsToApp = !frame.inApp && (nextFrame?.inApp || !nextFrame);
  const frameDisplayPath = getFrameDisplayPath(frame, platform);
  const frameFunctionName = frame.function ?? frame.rawFunction;
  const hasFrameFunction = !!frameFunctionName;
  const framePlatform = getPlatform(frame.platform, platform);
  const showPackage = !!frame.package && !isDotnet(framePlatform);
  const framePathTooltip =
    frame.absPath && frame.absPath !== frameDisplayPath ? frame.absPath : undefined;
  const packageTooltip = frame.package ?? undefined;
  const sourceMapInfoText = frame.mapUrl ?? frame.map;
  const shouldShowSourceMapInfo = !!frame.origAbsPath && !!sourceMapInfoText;
  const resolvedActions = typeof actions === 'function' ? actions({isHovering}) : actions;

  return (
    <FrameHeaderContainer
      data-test-id="core-stacktrace-frame-title"
      isExpandable={isExpandable}
      aria-expanded={isExpandable ? isExpanded : undefined}
      aria-controls={isExpandable ? frameContextId : undefined}
      onClick={() => {
        const selectedText = window.getSelection()?.toString();
        if (isExpandable && !selectedText) {
          toggleExpansion();
        }
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <FrameHeaderMain direction="column" align="start" flex="1" gap="2xs" minWidth={0}>
        <FrameTitle>
          {!isExpanded && leadsToApp ? (
            <FrameLeadHint as="span" size="xs" variant="muted">
              {getLeadHint({event, hasNextFrame: !!nextFrame})}
              {': '}
            </FrameLeadHint>
          ) : null}
          <Tooltip
            title={framePathTooltip}
            disabled={!framePathTooltip}
            maxWidth={750}
            skipWrapper
          >
            <FrameTitleFilename>
              <span>{frameDisplayPath}</span>
            </FrameTitleFilename>
          </Tooltip>
          {shouldShowSourceMapInfo ? (
            <Tooltip
              title={
                <SourceMapTooltipContent>
                  <strong>{t('Source Map')}</strong>
                  <span>{sourceMapInfoText}</span>
                </SourceMapTooltipContent>
              }
              maxWidth={400}
            >
              <SourceMapInfoTrigger
                aria-label={t('Source map info')}
                onClick={e => e.stopPropagation()}
              >
                <IconQuestion size="xs" />
              </SourceMapInfoTrigger>
            </Tooltip>
          ) : null}
          <FrameTitleMeta>
            {hasFrameFunction ? (
              <FrameTitleHint as="span" size="sm" variant="muted">
                {`${t('in')} `}
              </FrameTitleHint>
            ) : null}
            {hasFrameFunction ? (
              <FrameTitleFunction>{frameFunctionName}</FrameTitleFunction>
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
                <Tooltip
                  title={packageTooltip}
                  disabled={!packageTooltip}
                  maxWidth={750}
                  skipWrapper
                >
                  <FrameTitleMetaValue>{frame.package}</FrameTitleMetaValue>
                </Tooltip>
              </FrameLineMeta>
            ) : null}
          </FrameTitleMeta>
        </FrameTitle>
      </FrameHeaderMain>

      <FrameHeaderRight gap="xs" align="center">
        {frame.inApp ? null : <Tag variant="muted">{t('System')}</Tag>}
        <RepeatsIndicator timesRepeated={timesRepeated} />
        {frameBadge?.(frame)}

        <FrameHeaderTrailing
          data-test-id="core-stacktrace-frame-trailing"
          gap="xs"
          align="center"
        >
          {resolvedActions}
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
  padding: ${p => p.theme.space.md};
  background: ${p => p.theme.tokens.background.tertiary};

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

const RepeatedFrames = styled('span')`
  display: inline-flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
`;

const RepeatedContent = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.sm};
`;

const FrameTitle = styled('div')`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  column-gap: ${p => p.theme.space.xs};
  row-gap: 0;
  color: ${p => p.theme.tokens.content.primary};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.3;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  overflow-wrap: normal;
  user-select: text;
`;

const FrameTitleMeta = styled('span')`
  display: inline;
  max-width: 100%;
  min-width: 0;
  margin-left: ${p => p.theme.space.xs};
  white-space: nowrap;
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

const FrameTitleName = styled('span')`
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
  display: inline;
  margin-left: ${p => p.theme.space.xs};
  white-space: nowrap;
`;

const FrameTitleFilename = styled(FrameTitleName)`
  display: inline-block;
  vertical-align: baseline;
  flex: 1 1 auto;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
  text-align: left;

  > span {
    direction: ltr;
    unicode-bidi: isolate;
  }
`;

const FrameTitleMetaValue = styled(FrameTitleName)`
  display: inline-block;
  min-width: 0;
  max-width: min(45vw, 420px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SourceMapTooltipContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  word-break: break-all;
`;

const SourceMapInfoTrigger = styled('span')`
  display: inline-flex;
  align-items: center;
  margin-left: ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.content.secondary};
`;
