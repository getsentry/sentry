import {Fragment, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {openModal} from 'sentry/actionCreators/modal';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {analyzeFrameForRootCause} from 'sentry/components/events/interfaces/analyzeFrames';
import LeadHint from 'sentry/components/events/interfaces/frame/leadHint';
import {StacktraceLink} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {SourceMapsDebuggerModal} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {getThreadById} from 'sentry/components/events/interfaces/utils';
import StrictClick from 'sentry/components/strictClick';
import {IconChevron, IconFix, IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Frame} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';

import Context from './context';
import DefaultTitle from './defaultTitle';
import {OpenInContextLine} from './openInContextLine';
import {
  getPlatform,
  hasAssembly,
  hasContextRegisters,
  hasContextSource,
  hasContextVars,
  isPotentiallyThirdPartyFrame,
} from './utils';

const VALID_SOURCE_MAP_DEBUGGER_FILE_ENDINGS = [
  '.js',
  '.mjs',
  '.cjs',
  '.jsbundle', // React Native iOS file ending
  '.bundle', // React Native Android file ending
  '.hbc', // Hermes Bytecode (from Expo updates) file ending
  '.js.gz', // file ending idiomatic for Ember.js
];

export interface DeprecatedLineProps {
  data: Frame;
  emptySourceNotation: boolean;
  event: Event;
  frameMeta: Record<any, any>;
  frameSourceResolutionResults: FrameSourceMapDebuggerData | undefined;
  hiddenFrameCount: number | undefined;
  hideSourceMapDebugger: boolean;
  isANR: boolean;
  isExpanded: boolean;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed: boolean;
  lockAddress: string | undefined;
  nextFrame: Frame | undefined;
  platform: PlatformKey;
  registers: StacktraceType['registers'];
  threadId: number | undefined;
  timesRepeated: number;
  isShowFramesToggleExpanded?: boolean;
  /**
   * Frames that are hidden under the most recent non-InApp frame
   */
  isSubFrame?: boolean;
  onShowFramesToggle?: (event: React.MouseEvent<HTMLElement>) => void;
  registersMeta?: Record<any, any>;
}

interface Props extends DeprecatedLineProps {
  components: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>>;
}

function DeprecatedLine({
  data,
  emptySourceNotation,
  event,
  frameMeta,
  frameSourceResolutionResults,
  hiddenFrameCount,
  hideSourceMapDebugger,
  isANR,
  isExpanded: initialExpanded,
  isHoverPreviewed,
  lockAddress,
  nextFrame,
  platform: propPlatform,
  registers,
  threadId,
  timesRepeated,
  isShowFramesToggleExpanded,
  isSubFrame,
  onShowFramesToggle,
  registersMeta,
  components,
}: Props) {
  const organization = useOrganization();
  const [isHovering, setIsHovering] = useState(false);
  const [isExpanded, setIsExpanded] = useState(initialExpanded ?? false);
  const platform = getPlatform(data.platform, propPlatform ?? 'other');
  const leadsToApp: boolean = !data.inApp && (nextFrame?.inApp || !nextFrame);

  const isExpandable = useMemo((): boolean => {
    return !!(
      (hasContextSource(data) && data.context) ||
      hasContextVars(data) ||
      hasContextRegisters(registers) ||
      hasAssembly(data, platform)
    );
  }, [data, registers, platform]);

  const toggleContext = (evt?: React.MouseEvent) => {
    evt?.preventDefault();
    setIsExpanded(!isExpanded);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const scrollToSuspectRootCause = (e: React.MouseEvent) => {
    e.stopPropagation(); // to prevent collapsing if collapsible
    document
      .getElementById(SectionKey.SUSPECT_ROOT_CAUSE)
      ?.scrollIntoView({block: 'start', behavior: 'smooth'});
  };

  const anrCulprit =
    isANR && analyzeFrameForRootCause(data, getThreadById(event, threadId), lockAddress);

  const frameHasValidFileEndingForSourceMapDebugger =
    VALID_SOURCE_MAP_DEBUGGER_FILE_ENDINGS.some(
      ending =>
        (data.absPath ?? '').endsWith(ending) || (data.filename ?? '').endsWith(ending)
    );

  // If context is available (non-empty), users can already see the source code
  // This means they have a "good stack trace" with readable source lines
  // In this case, we want to hide the 'unminify code' button since the
  // user already has sufficient debugging information
  const shouldShowSourceMapDebuggerButton =
    !hasContextSource(data) &&
    !hideSourceMapDebugger &&
    data.inApp &&
    frameHasValidFileEndingForSourceMapDebugger &&
    frameSourceResolutionResults &&
    !frameSourceResolutionResults.frameIsResolved;

  const sourceMapDebuggerAmplitudeData = {
    organization: organization ?? null,
    project_id: event.projectID,
    event_id: event.id,
    event_platform: event.platform,
    sdk_name: event.sdk?.name,
    sdk_version: event.sdk?.version,
  };

  const activeLineNumber = data.lineNo;
  const contextLine = (data?.context || []).find((l: any) => l[0] === activeLineNumber);
  // InApp or .NET because of: https://learn.microsoft.com/en-us/dotnet/standard/library-guidance/sourcelink
  const hasStacktraceLink =
    (data.inApp || event.platform === 'csharp') &&
    !!data.filename &&
    (isHovering || isExpanded);
  const showSentryAppStacktraceLinkInFrame = hasStacktraceLink && components.length > 0;

  const className = classNames({
    frame: true,
    'is-expandable': isExpandable,
    expanded: isExpanded,
    collapsed: !isExpanded,
    'system-frame': !data.inApp,
    'leads-to-app': leadsToApp,
  });

  return (
    <li data-test-id="line" className={className}>
      <StrictClick onClick={isExpandable ? toggleContext : undefined}>
        <DefaultLine
          data-test-id="title"
          isSubFrame={!!isSubFrame}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          isExpanded={isExpanded}
          isExpandable={isExpandable}
        >
          {isExpandable ? <InteractionStateLayer /> : null}
          <DefaultLineTitleWrapper isInAppFrame={data.inApp}>
            <LeftLineTitle>
              <div>
                <LeadHint
                  nextFrame={nextFrame}
                  event={event}
                  isExpanded={isExpanded}
                  leadsToApp={leadsToApp}
                />
                <DefaultTitle
                  frame={data}
                  platform={propPlatform ?? 'other'}
                  isHoverPreviewed={isHoverPreviewed}
                  meta={frameMeta}
                  isPotentiallyThirdParty={isPotentiallyThirdPartyFrame(data, event)}
                />
              </div>
            </LeftLineTitle>
          </DefaultLineTitleWrapper>
          <DefaultLineTagWrapper>
            <RepeatsIndicator timesRepeated={timesRepeated} />
            {organization?.features.includes('anr-analyze-frames') && anrCulprit ? (
              <Tag variant="warning" onClick={scrollToSuspectRootCause}>
                {t('Suspect Frame')}
              </Tag>
            ) : null}
            {hasStacktraceLink && !shouldShowSourceMapDebuggerButton && (
              <ErrorBoundary>
                <StacktraceLink
                  frame={data}
                  line={contextLine ? contextLine[1] : ''}
                  event={event}
                  disableSetup={isHoverPreviewed}
                />
              </ErrorBoundary>
            )}
            {showSentryAppStacktraceLinkInFrame && (
              <ErrorBoundary mini>
                <OpenInContextLine
                  lineNo={data.lineNo}
                  filename={data.filename || ''}
                  components={components}
                />
              </ErrorBoundary>
            )}
            {hiddenFrameCount ? (
              <ToggleButton
                analyticsEventName="Stacktrace Frames: toggled"
                analyticsEventKey="stacktrace_frames.toggled"
                analyticsParams={{
                  frame_count: hiddenFrameCount,
                  is_frame_expanded: isShowFramesToggleExpanded,
                }}
                size="zero"
                borderless
                onClick={e => {
                  onShowFramesToggle?.(e);
                }}
              >
                {isShowFramesToggleExpanded
                  ? tn('Hide %s more frame', 'Hide %s more frames', hiddenFrameCount)
                  : tn('Show %s more frame', 'Show %s more frames', hiddenFrameCount)}
              </ToggleButton>
            ) : null}
            {shouldShowSourceMapDebuggerButton ? (
              <Fragment>
                <SourceMapDebuggerModalButton
                  size="zero"
                  priority="default"
                  title={t(
                    'Click to learn how to show the original source code for this stack frame.'
                  )}
                  onClick={e => {
                    e.stopPropagation();

                    trackAnalytics(
                      'source_map_debug_blue_thunder.modal_opened',
                      sourceMapDebuggerAmplitudeData
                    );

                    openModal(
                      modalProps => (
                        <SourceMapsDebuggerModal
                          analyticsParams={sourceMapDebuggerAmplitudeData}
                          sourceResolutionResults={frameSourceResolutionResults}
                          organization={organization}
                          projectId={event.projectID}
                          {...modalProps}
                        />
                      ),
                      {
                        modalCss: css`
                          max-width: 800px;
                          width: 100%;
                        `,
                        onClose: () => {
                          trackAnalytics(
                            'source_map_debug_blue_thunder.modal_closed',
                            sourceMapDebuggerAmplitudeData
                          );
                        },
                      }
                    );
                  }}
                >
                  <IconFix size="xs" />
                  <SourceMapDebuggerButtonText>
                    {t('Unminify Code')}
                  </SourceMapDebuggerButtonText>
                </SourceMapDebuggerModalButton>
              </Fragment>
            ) : null}
            {data.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
            {isExpandable ? (
              <ToggleContextButton
                data-test-id={`toggle-button-${isExpanded ? 'expanded' : 'collapsed'}`}
                size="zero"
                aria-label={t('Toggle Context')}
                onClick={toggleContext}
                borderless
              >
                <IconChevron direction={isExpanded ? 'up' : 'down'} size="sm" />
              </ToggleContextButton>
            ) : (
              <div style={{width: 26, height: 20}} />
            )}
          </DefaultLineTagWrapper>
        </DefaultLine>
      </StrictClick>
      <Context
        frame={data}
        event={event}
        registers={registers}
        components={components}
        hasContextSource={hasContextSource(data)}
        hasContextVars={hasContextVars(data)}
        hasContextRegisters={hasContextRegisters(registers)}
        emptySourceNotation={emptySourceNotation}
        hasAssembly={hasAssembly(data, platform)}
        isExpanded={isExpanded}
        registersMeta={registersMeta}
        frameMeta={frameMeta}
        platform={propPlatform}
      />
    </li>
  );
}

export default withSentryAppComponents(DeprecatedLine, {
  componentType: 'stacktrace-link',
});

function RepeatsIndicator({timesRepeated}: {timesRepeated: number}) {
  if (!timesRepeated || timesRepeated <= 0) {
    return null;
  }

  return (
    <RepeatedFrames
      title={`Frame repeated ${timesRepeated} time${timesRepeated === 1 ? '' : 's'}`}
    >
      <RepeatedContent>
        <StyledIconRefresh />
        <span>{timesRepeated}</span>
      </RepeatedContent>
    </RepeatedFrames>
  );
}

const RepeatedFrames = styled('div')`
  display: inline-block;
`;

const DefaultLineTitleWrapper = styled('div')<{isInAppFrame: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${p => (p.isInAppFrame ? '' : p.theme.tokens.content.secondary)};
  font-style: ${p => (p.isInAppFrame ? '' : 'italic')};
`;

const LeftLineTitle = styled('div')`
  display: flex;
  align-items: center;
`;

const RepeatedContent = styled(LeftLineTitle)`
  justify-content: center;
`;

const DefaultLine = styled('div')<{
  isExpandable: boolean;
  isExpanded: boolean;
  isSubFrame: boolean;
}>`
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: ${p =>
    p.isSubFrame ? `${p.theme.colors.surface200}` : `${p.theme.colors.surface300}`};
  min-height: 40px;
  word-break: break-word;
  padding: ${space(0.75)} ${space(1.5)};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 16px;
  cursor: ${p => (p.isExpandable ? 'pointer' : 'default')};
  code {
    font-family: ${p => p.theme.text.family};
  }
`;

const StyledIconRefresh = styled(IconRefresh)`
  margin-right: ${space(0.25)};
`;

const DefaultLineTagWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const ToggleContextButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const ToggleButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
  font-style: italic;
  font-weight: ${p => p.theme.fontWeight.normal};
  padding: ${space(0.25)} ${space(0.5)};

  &:hover {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;

const SourceMapDebuggerButtonText = styled('span')`
  margin-left: ${space(0.5)};
`;

const SourceMapDebuggerModalButton = styled(Button)`
  height: 20px;
  padding: 0 ${space(0.75)};
  font-size: ${p => p.theme.fontSize.sm};
`;
