import React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import scrollToElement from 'scroll-to-element';

import Button from 'app/components/button';
import DebugImage from 'app/components/events/interfaces/debugMeta/debugImage';
import {combineStatus} from 'app/components/events/interfaces/debugMeta/utils';
import PackageLink from 'app/components/events/interfaces/packageLink';
import PackageStatus, {
  PackageStatusIcon,
} from 'app/components/events/interfaces/packageStatus';
import TogglableAddress, {
  AddressToggleIcon,
} from 'app/components/events/interfaces/togglableAddress';
import {SymbolicatorStatus} from 'app/components/events/interfaces/types';
import StrictClick from 'app/components/strictClick';
import {IconChevron, IconRefresh} from 'app/icons';
import {t} from 'app/locale';
import {DebugMetaActions} from 'app/stores/debugMetaStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Frame, Organization, PlatformType, SentryAppComponent} from 'app/types';
import {Event} from 'app/types/event';
import {defined, objectIsEmpty} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withOrganization from 'app/utils/withOrganization';
import withSentryAppComponents from 'app/utils/withSentryAppComponents';

import Context from './context';
import DefaultTitle from './defaultTitle';
import Symbol, {FunctionNameToggleIcon} from './symbol';
import {getPlatform, isDotnet} from './utils';

type Props = {
  data: Frame;
  event: Event;
  registers: Record<string, string>;
  components: Array<SentryAppComponent>;
  nextFrame?: Frame;
  prevFrame?: Frame;
  platform?: PlatformType;
  emptySourceNotation?: boolean;
  isOnlyFrame?: boolean;
  timesRepeated?: number;
  showingAbsoluteAddress?: boolean;
  onAddressToggle?: (event: React.MouseEvent<SVGElement>) => void;
  onFunctionNameToggle?: (event: React.MouseEvent<SVGElement>) => void;
  showCompleteFunctionName?: boolean;
  image?: React.ComponentProps<typeof DebugImage>['image'];
  maxLengthOfRelativeAddress?: number;
  isFrameAfterLastNonApp?: boolean;
  includeSystemFrames?: boolean;
  isExpanded?: boolean;
  isFirst?: boolean;
  isHoverPreviewed?: boolean;
  organization?: Organization;
};

type State = {
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

export class Line extends React.Component<Props, State> {
  static defaultProps = {
    isExpanded: false,
    emptySourceNotation: false,
    isHoverPreviewed: false,
  };

  // isExpanded can be initialized to true via parent component;
  // data synchronization is not important
  // https://facebook.github.io/react/tips/props-in-getInitialState-as-anti-pattern.html
  state = {
    isExpanded: this.props.isExpanded,
  };

  toggleContext = evt => {
    evt && evt.preventDefault();
    const {isFirst, isHoverPreviewed, organization} = this.props;

    if (isFirst && isHoverPreviewed) {
      trackAnalyticsEvent({
        eventKey: 'stacktrace.preview.first_frame_expand',
        eventName: 'Stack Trace Preview: Expand First Frame',
        organization_id: organization?.id ? parseInt(organization.id, 10) : undefined,
        issue_id: this.props.event.groupID,
      });
    }

    this.setState({
      isExpanded: !this.state.isExpanded,
    });
  };

  hasContextSource() {
    return defined(this.props.data.context) && !!this.props.data.context.length;
  }

  hasContextVars() {
    return !objectIsEmpty(this.props.data.vars || {});
  }

  hasContextRegisters() {
    return !objectIsEmpty(this.props.registers);
  }

  hasAssembly() {
    return isDotnet(this.getPlatform()) && defined(this.props.data.package);
  }

  isExpandable() {
    return (
      (!this.props.isOnlyFrame && this.props.emptySourceNotation) ||
      this.hasContextSource() ||
      this.hasContextVars() ||
      this.hasContextRegisters() ||
      this.hasAssembly()
    );
  }

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

  shouldShowLinkToImage() {
    const {symbolicatorStatus} = this.props.data;

    return (
      !!symbolicatorStatus && symbolicatorStatus !== SymbolicatorStatus.UNKNOWN_IMAGE
    );
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
    event.stopPropagation(); // to prevent collapsing if collapsable

    const {instructionAddr, addrMode} = this.props.data;
    if (instructionAddr) {
      DebugMetaActions.updateFilter(
        makeFilter(instructionAddr, addrMode, this.props.image)
      );
    }
    scrollToElement('#images-loaded');
  };

  preventCollapse = evt => {
    evt.stopPropagation();
  };

  renderExpander() {
    if (!this.isExpandable()) {
      return null;
    }

    const {isExpanded} = this.state;

    return (
      <ToggleContextButtonWrapper>
        <ToggleContextButton
          className="btn-toggle"
          css={isDotnet(this.getPlatform()) && {display: 'block !important'}} // remove important once we get rid of css files
          title={t('Toggle Context')}
          onClick={this.toggleContext}
        >
          <IconChevron direction={isExpanded ? 'down' : 'up'} size="8px" />
        </ToggleContextButton>
      </ToggleContextButtonWrapper>
    );
  }

  leadsToApp() {
    const {data, nextFrame} = this.props;
    return !data.inApp && ((nextFrame && nextFrame.inApp) || !nextFrame);
  }

  isFoundByStackScanning() {
    const {data} = this.props;

    return data.trust === 'scan' || data.trust === 'cfi-scan';
  }

  renderLeadHint() {
    const {isExpanded} = this.state;

    if (isExpanded) {
      return null;
    }

    const leadsToApp = this.leadsToApp();

    if (!leadsToApp) {
      return null;
    }

    const {nextFrame} = this.props;

    return !nextFrame ? (
      <LeadHint className="leads-to-app-hint" width="115px">
        {t('Crashed in non-app: ')}
      </LeadHint>
    ) : (
      <LeadHint className="leads-to-app-hint">{t('Called from: ')}</LeadHint>
    );
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

  renderDefaultLine() {
    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : undefined}>
        <DefaultLine className="title">
          <VertCenterWrapper>
            <div>
              {this.renderLeadHint()}
              <DefaultTitle
                frame={this.props.data}
                platform={this.props.platform ?? 'other'}
              />
            </div>
            {this.renderRepeats()}
          </VertCenterWrapper>
          {this.renderExpander()}
        </DefaultLine>
      </StrictClick>
    );
  }

  renderNativeLine() {
    const {
      data,
      showingAbsoluteAddress,
      onAddressToggle,
      onFunctionNameToggle,
      image,
      maxLengthOfRelativeAddress,
      isFrameAfterLastNonApp,
      includeSystemFrames,
      showCompleteFunctionName,
    } = this.props;

    const leadHint = this.renderLeadHint();
    const packageStatus = this.packageStatus();

    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : undefined}>
        <DefaultLine className="title as-table">
          <NativeLineContent isFrameAfterLastNonApp={!!isFrameAfterLastNonApp}>
            <PackageInfo>
              {leadHint}
              <PackageLink
                includeSystemFrames={!!includeSystemFrames}
                withLeadHint={leadHint !== null}
                packagePath={data.package}
                onClick={this.scrollToImage}
                isClickable={this.shouldShowLinkToImage()}
              >
                <PackageStatus
                  status={packageStatus}
                  tooltip={t('Go to Images Loaded')}
                />
              </PackageLink>
            </PackageInfo>
            {data.instructionAddr && (
              <TogglableAddress
                address={data.instructionAddr}
                startingAddress={image ? image.image_addr : null}
                isAbsolute={!!showingAbsoluteAddress}
                isFoundByStackScanning={this.isFoundByStackScanning()}
                isInlineFrame={!!this.isInlineFrame()}
                onToggle={onAddressToggle}
                relativeAddressMaxlength={maxLengthOfRelativeAddress}
              />
            )}
            <Symbol
              frame={data}
              showCompleteFunctionName={!!showCompleteFunctionName}
              onFunctionNameToggle={onFunctionNameToggle}
            />
          </NativeLineContent>
          {this.renderExpander()}
        </DefaultLine>
      </StrictClick>
    );
  }

  renderLine() {
    switch (this.getPlatform()) {
      case 'objc':
      // fallthrough
      case 'cocoa':
      // fallthrough
      case 'native':
        return this.renderNativeLine();
      default:
        return this.renderDefaultLine();
    }
  }

  render() {
    const data = this.props.data;

    const className = classNames({
      frame: true,
      'is-expandable': this.isExpandable(),
      expanded: this.state.isExpanded,
      collapsed: !this.state.isExpanded,
      'system-frame': !data.inApp,
      'frame-errors': data.errors,
      'leads-to-app': this.leadsToApp(),
    });
    const props = {className};

    return (
      <StyledLi {...props}>
        {this.renderLine()}
        <Context
          frame={data}
          event={this.props.event}
          registers={this.props.registers}
          components={this.props.components}
          hasContextSource={this.hasContextSource()}
          hasContextVars={this.hasContextVars()}
          hasContextRegisters={this.hasContextRegisters()}
          emptySourceNotation={this.props.emptySourceNotation}
          hasAssembly={this.hasAssembly()}
          expandable={this.isExpandable()}
          isExpanded={this.state.isExpanded}
          isHoverPreviewed={this.props.isHoverPreviewed}
        />
      </StyledLi>
    );
  }
}

export default withOrganization(
  withSentryAppComponents(Line, {componentType: 'stacktrace-link'})
);

const RepeatedFrames = styled('div')`
  display: inline-block;
  border-radius: 50px;
  padding: 1px 3px;
  margin-left: ${space(1)};
  border-width: thin;
  border-style: solid;
  border-color: ${p => p.theme.orange500};
  color: ${p => p.theme.orange500};
  background-color: ${p => p.theme.backgroundSecondary};
  white-space: nowrap;
`;

const VertCenterWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const RepeatedContent = styled(VertCenterWrapper)`
  justify-content: center;
`;

const PackageInfo = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  order: 2;
  align-items: flex-start;
  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    order: 0;
  }
`;

const NativeLineContent = styled('div')<{isFrameAfterLastNonApp: boolean}>`
  display: grid;
  flex: 1;
  grid-gap: ${space(0.5)};
  grid-template-columns: ${p => (p.isFrameAfterLastNonApp ? '167px' : '117px')} 1fr;
  align-items: flex-start;
  justify-content: flex-start;

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    grid-template-columns: ${p => (p.isFrameAfterLastNonApp ? '200px' : '150px')} 117px 1fr auto;
  }

  @media (min-width: ${props => props.theme.breakpoints[2]}) and (max-width: ${props =>
      props.theme.breakpoints[3]}) {
    grid-template-columns: ${p => (p.isFrameAfterLastNonApp ? '180px' : '140px')} 117px 1fr auto;
  }
`;

const DefaultLine = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
`;

const StyledIconRefresh = styled(IconRefresh)`
  margin-right: ${space(0.25)};
`;

const LeadHint = styled('div')<{width?: string}>`
  ${overflowEllipsis}
  max-width: ${p => (p.width ? p.width : '67px')}
`;

const ToggleContextButtonWrapper = styled('span')`
  margin-left: ${space(1)};
`;

// the Button's label has the padding of 3px because the button size has to be 16x16 px.
const ToggleContextButton = styled(Button)`
  span:first-child {
    padding: 3px;
  }
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
