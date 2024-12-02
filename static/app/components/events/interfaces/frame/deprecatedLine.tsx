import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {openModal} from 'sentry/actionCreators/modal';
import Tag from 'sentry/components/badge/tag';
import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {analyzeFrameForRootCause} from 'sentry/components/events/interfaces/analyzeFrames';
import LeadHint from 'sentry/components/events/interfaces/frame/line/leadHint';
import {StacktraceLink} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {SourceMapsDebuggerModal} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {getThreadById} from 'sentry/components/events/interfaces/utils';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import StrictClick from 'sentry/components/strictClick';
import {IconFix, IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import DebugMetaStore from 'sentry/stores/debugMetaStore';
import {space} from 'sentry/styles/space';
import type {Event, Frame} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import withOrganization from 'sentry/utils/withOrganization';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';

import type DebugImage from '../debugMeta/debugImage';
import {combineStatus} from '../debugMeta/utils';

import Context from './context';
import DefaultTitle from './defaultTitle';
import {OpenInContextLine} from './openInContextLine';
import {PackageStatusIcon} from './packageStatus';
import {FunctionNameToggleIcon} from './symbol';
import {AddressToggleIcon} from './togglableAddress';
import {
  getPlatform,
  hasAssembly,
  hasContextRegisters,
  hasContextSource,
  hasContextVars,
  isExpandable,
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
  event: Event;
  registers: Record<string, string>;
  emptySourceNotation?: boolean;
  frameMeta?: Record<any, any>;
  frameSourceResolutionResults?: FrameSourceMapDebuggerData;
  hiddenFrameCount?: number;
  hideSourceMapDebugger?: boolean;
  image?: React.ComponentProps<typeof DebugImage>['image'];
  includeSystemFrames?: boolean;
  isANR?: boolean;
  isExpanded?: boolean;
  isFrameAfterLastNonApp?: boolean;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed?: boolean;
  isOnlyFrame?: boolean;
  isShowFramesToggleExpanded?: boolean;
  /**
   * Frames that are hidden under the most recent non-InApp frame
   */
  isSubFrame?: boolean;
  lockAddress?: string;
  maxLengthOfRelativeAddress?: number;
  nextFrame?: Frame;
  onAddressToggle?: (event: React.MouseEvent<SVGElement>) => void;
  onFunctionNameToggle?: (event: React.MouseEvent<SVGElement>) => void;
  onShowFramesToggle?: (event: React.MouseEvent<HTMLElement>) => void;
  organization?: Organization;
  platform?: PlatformKey;
  prevFrame?: Frame;
  registersMeta?: Record<any, any>;
  showCompleteFunctionName?: boolean;
  showingAbsoluteAddress?: boolean;
  threadId?: number;
  timesRepeated?: number;
}

interface Props extends DeprecatedLineProps {
  components: SentryAppComponent<SentryAppSchemaStacktraceLink>[];
}

type State = {
  isHovering: boolean;
  isExpanded?: boolean;
};

function makeFilter(
  addr: string,
  addrMode: string | undefined,
  image?: React.ComponentProps<typeof DebugImage>['image']
): string {
  if (!(!addrMode || addrMode === 'abs') && image) {
    return `${image.debug_id}!${addr}`;
  }

  return addr;
}

export class DeprecatedLine extends Component<Props, State> {
  static defaultProps = {
    isExpanded: false,
    emptySourceNotation: false,
    isHoverPreviewed: false,
  };

  // isExpanded can be initialized to true via parent component;
  // data synchronization is not important
  // https://facebook.github.io/react/tips/props-in-getInitialState-as-anti-pattern.html
  state: State = {
    isExpanded: this.props.isExpanded,
    isHovering: false,
  };

  handleMouseEnter = () => {
    this.setState({isHovering: true});
  };

  handleMouseLeave = () => {
    this.setState({isHovering: false});
  };

  toggleContext = evt => {
    evt?.preventDefault();

    this.setState({
      isExpanded: !this.state.isExpanded,
    });
  };

  getPlatform() {
    // prioritize the frame platform but fall back to the platform
    // of the stack trace / exception
    return getPlatform(this.props.data.platform, this.props.platform ?? 'other');
  }

  isInlineFrame() {
    return (
      this.props.prevFrame &&
      this.getPlatform() === (this.props.prevFrame.platform || this.props.platform) &&
      this.props.data.instructionAddr === this.props.prevFrame.instructionAddr
    );
  }

  isExpandable() {
    const {registers, platform, emptySourceNotation, isOnlyFrame, data} = this.props;
    return isExpandable({
      frame: data,
      registers,
      platform,
      emptySourceNotation,
      isOnlyFrame,
    });
  }

  packageStatus() {
    // this is the status of image that belongs to this frame
    const {image} = this.props;
    if (!image) {
      return 'empty';
    }

    const combinedStatus = combineStatus(image.debug_status, image.unwind_status);

    switch (combinedStatus) {
      case 'unused':
        return 'empty';
      case 'found':
        return 'success';
      default:
        return 'error';
    }
  }

  scrollToImage = event => {
    event.stopPropagation(); // to prevent collapsing if collapsible

    const {instructionAddr, addrMode} = this.props.data;
    if (instructionAddr) {
      DebugMetaStore.updateFilter(
        makeFilter(instructionAddr, addrMode, this.props.image)
      );
    }

    document
      .getElementById(SectionKey.DEBUGMETA)
      ?.scrollIntoView({block: 'start', behavior: 'smooth'});
  };

  scrollToSuspectRootCause = event => {
    event.stopPropagation(); // to prevent collapsing if collapsible
    document
      .getElementById(SectionKey.SUSPECT_ROOT_CAUSE)
      ?.scrollIntoView({block: 'start', behavior: 'smooth'});
  };

  preventCollapse = evt => {
    evt.stopPropagation();
  };

  renderExpander() {
    if (!this.isExpandable()) {
      return <div style={{width: 20, height: 20}} />;
    }

    const {isExpanded} = this.state;

    return (
      <ToggleContextButton
        data-test-id={`toggle-button-${isExpanded ? 'expanded' : 'collapsed'}`}
        size="zero"
        aria-label={t('Toggle Context')}
        onClick={this.toggleContext}
        borderless
      >
        <Chevron direction={isExpanded ? 'up' : 'down'} size="medium" />
      </ToggleContextButton>
    );
  }

  leadsToApp() {
    const {data, nextFrame} = this.props;
    return !data.inApp && (nextFrame?.inApp || !nextFrame);
  }

  isFoundByStackScanning() {
    const {data} = this.props;

    return data.trust === 'scan' || data.trust === 'cfi-scan';
  }

  renderLeadHint() {
    const {isExpanded} = this.state;
    const {event, nextFrame} = this.props;
    const leadsToApp = this.leadsToApp();

    return <LeadHint {...{nextFrame, event, isExpanded, leadsToApp}} />;
  }

  renderRepeats() {
    const timesRepeated = this.props.timesRepeated;
    if (timesRepeated && timesRepeated > 0) {
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

    return null;
  }

  renderShowHideToggle() {
    const hiddenFrameCount = this.props.hiddenFrameCount;
    const isShowFramesToggleExpanded = this.props.isShowFramesToggleExpanded;
    if (hiddenFrameCount) {
      return (
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
            this.props.onShowFramesToggle?.(e);
          }}
        >
          {isShowFramesToggleExpanded
            ? tn('Hide %s more frame', 'Hide %s more frames', hiddenFrameCount)
            : tn('Show %s more frame', 'Show %s more frames', hiddenFrameCount)}
        </ToggleButton>
      );
    }
    return null;
  }

  renderDefaultLine() {
    const {isHoverPreviewed, data, isANR, threadId, lockAddress, isSubFrame, event} =
      this.props;
    const {isHovering, isExpanded} = this.state;
    const organization = this.props.organization;
    const anrCulprit =
      isANR &&
      analyzeFrameForRootCause(
        data,
        getThreadById(this.props.event, threadId),
        lockAddress
      );

    const frameHasValidFileEndingForSourceMapDebugger =
      VALID_SOURCE_MAP_DEBUGGER_FILE_ENDINGS.some(
        ending =>
          (data.absPath ?? '').endsWith(ending) || (data.filename ?? '').endsWith(ending)
      );

    const shouldShowSourceMapDebuggerButton =
      !this.props.hideSourceMapDebugger &&
      data.inApp &&
      frameHasValidFileEndingForSourceMapDebugger &&
      this.props.frameSourceResolutionResults &&
      (!this.props.frameSourceResolutionResults.frameIsResolved ||
        !hasContextSource(data));

    const sourceMapDebuggerAmplitudeData = {
      organization: this.props.organization ?? null,
      project_id: this.props.event.projectID,
      event_id: this.props.event.id,
      event_platform: this.props.event.platform,
      sdk_name: this.props.event.sdk?.name,
      sdk_version: this.props.event.sdk?.version,
    };

    const activeLineNumber = data.lineNo;
    const contextLine = (data?.context || []).find(l => l[0] === activeLineNumber);
    // InApp or .NET because of: https://learn.microsoft.com/en-us/dotnet/standard/library-guidance/sourcelink
    const hasStacktraceLink =
      (data.inApp || event.platform === 'csharp') &&
      !!data.filename &&
      (isHovering || isExpanded);
    const showSentryAppStacktraceLinkInFrame =
      hasStacktraceLink && this.props.components.length > 0;

    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : undefined}>
        <DefaultLine
          data-test-id="title"
          isSubFrame={!!isSubFrame}
          onMouseEnter={() => this.handleMouseEnter()}
          onMouseLeave={() => this.handleMouseLeave()}
          isExpanded={this.state.isExpanded ?? false}
          isExpandable={this.isExpandable()}
        >
          {this.isExpandable() ? <InteractionStateLayer /> : null}
          <DefaultLineTitleWrapper isInAppFrame={data.inApp}>
            <LeftLineTitle>
              <div>
                {this.renderLeadHint()}
                <DefaultTitle
                  frame={data}
                  platform={this.props.platform ?? 'other'}
                  isHoverPreviewed={isHoverPreviewed}
                  meta={this.props.frameMeta}
                />
              </div>
            </LeftLineTitle>
          </DefaultLineTitleWrapper>
          <DefaultLineTagWrapper>
            {this.renderRepeats()}
            {organization?.features.includes('anr-analyze-frames') && anrCulprit ? (
              <Tag type="warning" to="" onClick={this.scrollToSuspectRootCause}>
                {t('Suspect Frame')}
              </Tag>
            ) : null}
            {hasStacktraceLink && !shouldShowSourceMapDebuggerButton && (
              <ErrorBoundary>
                <StacktraceLink
                  frame={data}
                  line={contextLine ? contextLine[1] : ''}
                  event={this.props.event}
                />
              </ErrorBoundary>
            )}
            {showSentryAppStacktraceLinkInFrame && (
              <ErrorBoundary mini>
                <OpenInContextLine
                  lineNo={data.lineNo}
                  filename={data.filename || ''}
                  components={this.props.components}
                />
              </ErrorBoundary>
            )}
            {this.renderShowHideToggle()}
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
                          sourceResolutionResults={
                            this.props.frameSourceResolutionResults!
                          }
                          {...modalProps}
                        />
                      ),
                      {
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
            {data.inApp ? <Tag type="info">{t('In App')}</Tag> : null}
            {this.renderExpander()}
          </DefaultLineTagWrapper>
        </DefaultLine>
      </StrictClick>
    );
  }

  render() {
    const data = this.props.data;

    const className = classNames({
      frame: true,
      'is-expandable': this.isExpandable(),
      expanded: this.state.isExpanded,
      collapsed: !this.state.isExpanded,
      'system-frame': !data.inApp,
      'leads-to-app': this.leadsToApp(),
    });
    const props = {className};

    return (
      <StyledLi data-test-id="line" {...props}>
        {this.renderDefaultLine()}
        <Context
          frame={data}
          event={this.props.event}
          registers={this.props.registers}
          components={this.props.components}
          hasContextSource={hasContextSource(data)}
          hasContextVars={hasContextVars(data)}
          hasContextRegisters={hasContextRegisters(this.props.registers)}
          emptySourceNotation={this.props.emptySourceNotation}
          hasAssembly={hasAssembly(data, this.props.platform)}
          isExpanded={this.state.isExpanded}
          registersMeta={this.props.registersMeta}
          frameMeta={this.props.frameMeta}
          platform={this.props.platform}
        />
      </StyledLi>
    );
  }
}

export default withOrganization(
  withSentryAppComponents(DeprecatedLine, {componentType: 'stacktrace-link'})
);

const RepeatedFrames = styled('div')`
  display: inline-block;
`;

const DefaultLineTitleWrapper = styled('div')<{isInAppFrame: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${p => (!p.isInAppFrame ? p.theme.subText : '')};
  font-style: ${p => (!p.isInAppFrame ? 'italic' : '')};
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
  background: ${p => (p.isSubFrame ? `${p.theme.surface100}` : `${p.theme.surface200}`)};
  min-height: 32px;
  word-break: break-word;
  padding: ${space(0.75)} ${space(1.5)};
  font-size: ${p => p.theme.fontSizeSmall};
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
  color: ${p => p.theme.subText};
`;

const StyledLi = styled('li')`
  ${PackageStatusIcon} {
    flex-shrink: 0;
  }
  :hover {
    ${PackageStatusIcon} {
      visibility: visible;
    }
    ${AddressToggleIcon} {
      visibility: visible;
    }
    ${FunctionNameToggleIcon} {
      visibility: visible;
    }
  }
`;

const ToggleButton = styled(Button)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-style: italic;
  font-weight: ${p => p.theme.fontWeightNormal};
  padding: ${space(0.25)} ${space(0.5)};

  &:hover {
    color: ${p => p.theme.subText};
  }
`;

const SourceMapDebuggerButtonText = styled('span')`
  margin-left: ${space(0.5)};
`;

const SourceMapDebuggerModalButton = styled(Button)`
  height: 20px;
  padding: 0 ${space(0.75)};
  font-size: ${p => p.theme.fontSizeSmall};
`;
