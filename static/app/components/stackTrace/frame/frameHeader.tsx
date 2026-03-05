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
            <Text as="span" size="xs" variant="muted" monospace italic>
              {getLeadHint({event, hasNextFrame: !!nextFrame})}
              {': '}
            </Text>
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
              <Text as="span" size="xs" variant="muted" monospace>
                {t('in')}
              </Text>
            ) : null}
            {hasFrameFunction ? (
              <FrameTitleFunction>{frameFunctionName}</FrameTitleFunction>
            ) : null}
            {frame.lineNo ? (
              <FrameLineMeta>
                <Text as="span" size="xs" variant="muted" monospace>
                  {' '}
                  {t('line')}{' '}
                </Text>
                <Text as="span" size="xs" monospace>
                  {frame.colNo ? `${frame.lineNo}:${frame.colNo}` : frame.lineNo}
                </Text>
              </FrameLineMeta>
            ) : null}
            {showPackage ? (
              <FrameLineMeta>
                <Text as="span" size="xs" variant="muted" monospace>
                  {t('within')}
                </Text>
                <FrameTitleMetaValue>{frame.package}</FrameTitleMetaValue>
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
  column-gap: ${p => p.theme.space.sm};
  row-gap: 0;
  color: ${p => p.theme.tokens.content.primary};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.3;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  overflow-wrap: normal;
`;

const FrameTitleMeta = styled('span')`
  display: inline-flex;
  align-items: baseline;
  gap: ${p => p.theme.space.sm};
  max-width: 100%;
  min-width: 0;
  margin-left: 0;
  white-space: nowrap;
`;

const FrameTitleFunction = styled('span')`
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FrameLineMeta = styled('span')`
  display: inline-flex;
  align-items: baseline;
  gap: ${p => p.theme.space['2xs']};
  line-height: inherit;
  margin-left: 0;
  white-space: nowrap;

  > * {
    line-height: inherit;
  }
`;

const FrameTitleFilename = styled('span')`
  display: inline-block;
  vertical-align: baseline;
  flex: 0 1 auto;
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

const FrameTitleMetaValue = styled('span')`
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  display: inline-block;
  vertical-align: baseline;
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
