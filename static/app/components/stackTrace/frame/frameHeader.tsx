import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {
  getLeadHint,
  getPlatform,
  isDotnet,
} from 'sentry/components/events/interfaces/frame/utils';
import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import type {Frame} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {isUrl} from 'sentry/utils/string/isUrl';

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
    frame,
    frameContextId,
    isExpandable,
    isExpanded,
    nextFrame,
    platform,
    toggleExpansion,
  } = useStackTraceFrameContext();

  const resolvedActions = typeof actions === 'function' ? actions({isHovering}) : actions;
  const leadsToApp = !frame.inApp && (nextFrame?.inApp || !nextFrame);
  const hasLeadHint = !isExpanded && leadsToApp;

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
      <MainContent isMuted={hasLeadHint} isExpanded={isExpanded}>
        <FrameLocation
          frame={frame}
          platform={platform}
          isExpanded={isExpanded}
          leadsToApp={leadsToApp}
          hasNextFrame={!!nextFrame}
        />
        <FrameContext frame={frame} platform={platform} />
      </MainContent>

      <ActionArea>
        <TrailingActions data-test-id="core-stacktrace-frame-trailing">
          {resolvedActions}
        </TrailingActions>
      </ActionArea>
    </HeaderGrid>
  );
}

function FrameLocation({
  frame,
  platform,
  isExpanded,
  leadsToApp,
  hasNextFrame,
}: {
  frame: Frame;
  hasNextFrame: boolean;
  isExpanded: boolean;
  leadsToApp: boolean;
  platform: PlatformKey;
}) {
  const {event} = useStackTraceFrameContext();
  const frameDisplayPath = getFrameDisplayPath(frame, platform);
  const frameLocationSuffix = formatFrameLocation('', frame.lineNo, frame.colNo);

  return (
    <LocationWrapper>
      {!isExpanded && leadsToApp ? (
        <LeadHint>
          {getLeadHint({event, hasNextFrame})}
          {': '}
        </LeadHint>
      ) : null}
      <FrameLocationTooltip frame={frame}>
        <Path>
          <span>
            <span>{frameDisplayPath}</span>
            {frameLocationSuffix ? <span>{frameLocationSuffix}</span> : null}
          </span>
        </Path>
      </FrameLocationTooltip>
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

function FrameLocationTooltip({
  frame,
  children,
}: {
  children: React.ReactNode;
  frame: Frame;
}) {
  const sourceMap = frame.mapUrl ?? frame.map;
  const showSourceMap = !!frame.origAbsPath && !!sourceMap;
  const externalUrl = frame.absPath && isUrl(frame.absPath) ? frame.absPath : undefined;

  const hasContent = !!frame.absPath || showSourceMap || !!externalUrl;

  return (
    <Tooltip
      title={
        <TooltipContent>
          {frame.absPath ? (
            <Fragment>
              <strong>{t('Absolute Path')}</strong>
              <span>{frame.absPath}</span>
            </Fragment>
          ) : null}
          {showSourceMap ? (
            <Fragment>
              <strong>{t('Source Map')}</strong>
              <span>{sourceMap}</span>
            </Fragment>
          ) : null}
          {externalUrl ? (
            <Fragment>
              <strong>{t('URL')}</strong>
              <a
                role="link"
                onClick={e => {
                  e.stopPropagation();
                  openNavigateToExternalLinkModal({linkText: externalUrl});
                }}
              >
                {externalUrl}
              </a>
            </Fragment>
          ) : null}
        </TooltipContent>
      }
      disabled={!hasContent}
      maxWidth={475}
      skipWrapper
      delay={1000}
      isHoverable
    >
      {children}
    </Tooltip>
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
  background: ${p => p.theme.tokens.background.secondary};

  &:hover {
    background: ${p => p.theme.tokens.background.tertiary};
  }
`;

const MainContent = styled('div')<{isExpanded: boolean; isMuted: boolean}>`
  display: flex;
  flex-wrap: ${p => (p.isExpanded && !p.isMuted ? 'wrap' : 'nowrap')};
  row-gap: ${p => p.theme.space['2xs']};
  column-gap: ${p => p.theme.space.sm};
  align-items: baseline;
  color: ${p =>
    p.isMuted ? p.theme.tokens.content.secondary : p.theme.tokens.content.primary};
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
  flex: 0 1 auto;
  overflow: hidden;
`;

const LeadHint = styled('span')`
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

const ContextWrapper = styled('span')`
  display: inline-flex;
  align-items: baseline;
  flex: 0 999 auto;
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

const TooltipContent = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: baseline;
  column-gap: ${p => p.theme.space.sm};
  row-gap: ${p => p.theme.space.md};
  word-break: break-all;
  text-align: left;
`;
