import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

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
import {IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Frame} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import {defined} from 'sentry/utils';

function getFrameDisplayPath(frame: Frame, platform: PlatformKey) {
  const framePlatform = getPlatform(frame.platform, platform);

  if (framePlatform === 'java') {
    return frame.module ?? frame.filename ?? '';
  }

  return frame.filename ?? frame.module ?? '';
}

function formatFrameLocation(
  path: string,
  lineNo: number | null | undefined,
  colNo: number | null | undefined
): string {
  if (!defined(lineNo) || lineNo < 0) {
    return path;
  }

  if (!defined(colNo) || colNo < 0) {
    return `${path}:${lineNo}`;
  }

  return `${path}:${lineNo}:${colNo}`;
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

  const resolvedActions = typeof actions === 'function' ? actions({isHovering}) : actions;
  const hasLeadHint = !isExpanded && !frame.inApp && (nextFrame?.inApp || !nextFrame);

  return (
    <HeaderGrid
      data-test-id="core-stacktrace-frame-title"
      isExpandable={isExpandable}
      hasLeadHint={hasLeadHint}
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
      <MainContent noWrap={!isExpanded}>
        <FrameLocation
          frame={frame}
          nextFrame={nextFrame}
          event={event}
          platform={platform}
          isExpanded={isExpanded}
        />
        <FrameContext frame={frame} platform={platform} />
      </MainContent>

      <ActionArea>
        <RepeatsIndicator timesRepeated={timesRepeated} />
        {frameBadge?.(frame)}
        <TrailingActions data-test-id="core-stacktrace-frame-trailing">
          {resolvedActions}
        </TrailingActions>
      </ActionArea>
    </HeaderGrid>
  );
}

function FrameLocation({
  frame,
  nextFrame,
  event,
  platform,
  isExpanded,
}: {
  event: any;
  frame: Frame;
  isExpanded: boolean;
  nextFrame: Frame | undefined;
  platform: PlatformKey;
}) {
  const leadsToApp = !frame.inApp && (nextFrame?.inApp || !nextFrame);
  const frameDisplayPath = getFrameDisplayPath(frame, platform);

  const frameLocationSuffix =
    defined(frame.lineNo) && frame.lineNo >= 0
      ? defined(frame.colNo) && frame.colNo >= 0
        ? `:${frame.lineNo}:${frame.colNo}`
        : `:${frame.lineNo}`
      : '';

  const framePathTooltip =
    frame.absPath && frame.absPath !== frameDisplayPath
      ? formatFrameLocation(frame.absPath, frame.lineNo, frame.colNo)
      : undefined;

  const sourceMapInfoText = frame.mapUrl ?? frame.map;
  const shouldShowSourceMapInfo = !!frame.origAbsPath && !!sourceMapInfoText;

  const frameInfoTooltip =
    framePathTooltip || shouldShowSourceMapInfo ? (
      <CombinedTooltipContent
        absPath={framePathTooltip}
        sourceMapInfo={shouldShowSourceMapInfo ? sourceMapInfoText : undefined}
      />
    ) : undefined;

  return (
    <LocationWrapper>
      {!isExpanded && leadsToApp ? (
        <LeadHint>
          {getLeadHint({event, hasNextFrame: !!nextFrame})}
          {': '}
        </LeadHint>
      ) : null}
      <Tooltip
        title={frameInfoTooltip}
        disabled={!frameInfoTooltip}
        maxWidth={600}
        skipWrapper
        delay={1000}
      >
        <Path data-test-id="core-stacktrace-frame-location">
          <span>
            <span>{frameDisplayPath}</span>
            {frameLocationSuffix ? (
              <LocationSuffix>{frameLocationSuffix}</LocationSuffix>
            ) : null}
          </span>
        </Path>
      </Tooltip>
    </LocationWrapper>
  );
}

function FrameContext({frame, platform}: {frame: Frame; platform: PlatformKey}) {
  const frameFunctionName = frame.function ?? frame.rawFunction;
  const hasFrameFunction = !!frameFunctionName;
  const framePlatform = getPlatform(frame.platform, platform);
  const showPackage = !!frame.package && !isDotnet(framePlatform);

  if (!hasFrameFunction && !showPackage) {
    return null;
  }

  return (
    <ContextWrapper>
      {hasFrameFunction ? (
        <Fragment>
          <Text as="span" size="xs" variant="muted" monospace>
            {t('in')}
          </Text>
          <FuncName>{frameFunctionName}</FuncName>
        </Fragment>
      ) : null}
      {showPackage ? (
        <Fragment>
          <Text as="span" size="xs" variant="muted" monospace>
            {t('within')}
          </Text>
          <PkgName>{frame.package}</PkgName>
        </Fragment>
      ) : null}
    </ContextWrapper>
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

function CombinedTooltipContent({
  absPath,
  sourceMapInfo,
}: {
  absPath: string | undefined;
  sourceMapInfo: string | undefined;
}) {
  return (
    <CombinedTooltipContentContainer>
      {absPath ? <span>{absPath}</span> : null}
      {sourceMapInfo ? (
        <Fragment>
          <strong>{t('Source Map')}</strong>
          <span>{sourceMapInfo}</span>
        </Fragment>
      ) : null}
    </CombinedTooltipContentContainer>
  );
}

const HeaderGrid = styled('div')<{isExpandable: boolean; hasLeadHint?: boolean}>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) min-content;
  gap: ${p => p.theme.space.sm};
  align-items: center;
  width: 100%;
  cursor: ${p => (p.isExpandable ? 'pointer' : 'default')};
  text-align: left;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  background: ${p => p.theme.tokens.background.tertiary};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const MainContent = styled('div')<{noWrap?: boolean}>`
  display: flex;
  flex-wrap: ${p => (p.noWrap ? 'nowrap' : 'wrap')};
  row-gap: ${p => p.theme.space['2xs']};
  column-gap: ${p => p.theme.space.sm};
  align-items: baseline;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.5;
  min-width: 0;
`;

const ActionArea = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  min-width: 0;
`;

const TrailingActions = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  margin-left: auto;
`;

const LocationWrapper = styled('span')`
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  max-width: 100%;
  flex: 0 999 auto;
  overflow: hidden;
`;

const LeadHint = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-style: italic;
  font-size: inherit;
  line-height: inherit;
  white-space: nowrap;
  flex-shrink: 0;
  margin-right: ${p => p.theme.space['2xs']};
`;

const Path = styled('span')`
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

const LocationSuffix = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const ContextWrapper = styled('span')`
  display: inline-flex;
  align-items: baseline;
  flex: 0 1 auto;
  gap: ${p => p.theme.space.sm};
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
`;

const FuncName = styled('span')`
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PkgName = styled('span')`
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

const CombinedTooltipContentContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  word-break: break-all;
`;
