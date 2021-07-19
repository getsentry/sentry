import * as React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import scrollToElement from 'scroll-to-element';

import Button from 'app/components/button';
import DebugImage from 'app/components/events/interfaces/debugMeta/debugImage';
import {combineStatus} from 'app/components/events/interfaces/debugMeta/utils';
import PackageLink, {
  Package,
  PackageName,
} from 'app/components/events/interfaces/packageLink';
import PackageStatus, {
  PackageStatusIcon,
} from 'app/components/events/interfaces/packageStatus';
import TogglableAddress, {
  AddressToggleIcon,
} from 'app/components/events/interfaces/togglableAddress';
import {SymbolicatorStatus} from 'app/components/events/interfaces/types';
import {STACKTRACE_PREVIEW_TOOLTIP_DELAY} from 'app/components/stacktracePreview';
import StrictClick from 'app/components/strictClick';
import {IconChevron, IconRefresh} from 'app/icons';
import {t} from 'app/locale';
import {DebugMetaActions} from 'app/stores/debugMetaStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {
  Frame,
  FrameBadge,
  Organization,
  PlatformType,
  SentryAppComponent,
} from 'app/types';
import {Event} from 'app/types/event';
import withOrganization from 'app/utils/withOrganization';
import withSentryAppComponents from 'app/utils/withSentryAppComponents';

import Badge from './badge';
import Context from './context';
import DefaultTitle from './defaultTitle';
import Symbol, {FunctionNameToggleIcon} from './symbol';
import {
  getPlatform,
  hasAssembly,
  hasContextRegisters,
  hasContextSource,
  hasContextVars,
  isDotnet,
  isExpandable,
} from './utils';

type Props = {
  data: Frame;
  event: Event;
  registers: Record<string, string>;
  components: Array<SentryAppComponent>;
  hasGroupingTreeUI?: boolean;
  hasAtLeastOneExpandableFrame?: boolean;
  isPrefix?: boolean;
  isSentinel?: boolean;
  isUsedForGrouping?: boolean;
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
  organization?: Organization;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed?: boolean;
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
  state: State = {
    isExpanded: this.props.isExpanded,
  };

  toggleContext = evt => {
    evt && evt.preventDefault();

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

  shouldShowLinkToImage() {
    const {isHoverPreviewed, data} = this.props;
    const {symbolicatorStatus} = data;

    return (
      !!symbolicatorStatus &&
      symbolicatorStatus !== SymbolicatorStatus.UNKNOWN_IMAGE &&
      !isHoverPreviewed
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

    const {isHoverPreviewed} = this.props;
    const {isExpanded} = this.state;

    return (
      <ToggleContextButtonWrapper>
        <ToggleContextButton
          className="btn-toggle"
          css={isDotnet(this.getPlatform()) && {display: 'block !important'}} // remove important once we get rid of css files
          title={t('Toggle Context')}
          tooltipProps={
            isHoverPreviewed ? {delay: STACKTRACE_PREVIEW_TOOLTIP_DELAY} : undefined
          }
          onClick={this.toggleContext}
        >
          <IconChevron direction={isExpanded ? 'up' : 'down'} size="8px" />
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
        {t('Crashed in non-app')}
        {': '}
      </LeadHint>
    ) : (
      <LeadHint className="leads-to-app-hint">
        {t('Called from')}
        {': '}
      </LeadHint>
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
    const {isHoverPreviewed} = this.props;

    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : undefined}>
        <DefaultLine className="title">
          <VertCenterWrapper>
            <div>
              {this.renderLeadHint()}
              <DefaultTitle
                frame={this.props.data}
                platform={this.props.platform ?? 'other'}
                isHoverPreviewed={isHoverPreviewed}
              />
            </div>
            {this.renderRepeats()}
          </VertCenterWrapper>
          {this.renderExpander()}
        </DefaultLine>
      </StrictClick>
    );
  }

  renderGroupingBadges() {
    const {isPrefix, isSentinel, isUsedForGrouping} = this.props;

    const badges: React.ReactElement[] = [];

    if (isSentinel) {
      badges.push(<Badge badge={FrameBadge.SENTINEL} />);
    }

    if (isPrefix) {
      badges.push(<Badge badge={FrameBadge.PREFIX} />);
    }

    if (isUsedForGrouping) {
      badges.push(<Badge badge={FrameBadge.GROUPING} />);
    }

    return badges;
  }

  renderNativeLine() {
    const {
      data,
      showingAbsoluteAddress,
      onAddressToggle,
      onFunctionNameToggle,
      image,
      maxLengthOfRelativeAddress,
      includeSystemFrames,
      isFrameAfterLastNonApp,
      showCompleteFunctionName,
      isHoverPreviewed,
      hasGroupingTreeUI,
      hasAtLeastOneExpandableFrame,
    } = this.props;

    const leadHint = this.renderLeadHint();
    const packageStatus = this.packageStatus();

    if (hasGroupingTreeUI) {
      return (
        <StrictClick onClick={this.isExpandable() ? this.toggleContext : undefined}>
          <FrameLine
            className="title as-table"
            hasAtLeastOneExpandableFrame={hasAtLeastOneExpandableFrame}
          >
            <FramePackageInfo>
              {leadHint}
              <PackageLink
                includeSystemFrames={!!includeSystemFrames}
                withLeadHint={leadHint !== null}
                packagePath={data.package}
                onClick={this.scrollToImage}
                isClickable={this.shouldShowLinkToImage()}
                isHoverPreviewed={isHoverPreviewed}
              >
                {!isHoverPreviewed && (
                  <PackageStatus
                    status={packageStatus}
                    tooltip={t('Go to Images Loaded')}
                  />
                )}
              </PackageLink>
            </FramePackageInfo>
            {data.instructionAddr && (
              <StyledTogglableAddress
                address={data.instructionAddr}
                startingAddress={image ? image.image_addr : null}
                isAbsolute={!!showingAbsoluteAddress}
                isFoundByStackScanning={this.isFoundByStackScanning()}
                isInlineFrame={!!this.isInlineFrame()}
                onToggle={onAddressToggle}
                relativeAddressMaxlength={maxLengthOfRelativeAddress}
                isHoverPreviewed={isHoverPreviewed}
              />
            )}
            <StyledSymbol
              frame={data}
              showCompleteFunctionName={!!showCompleteFunctionName}
              onFunctionNameToggle={onFunctionNameToggle}
              isHoverPreviewed={isHoverPreviewed}
            />
            <FrameBadges>
              {data.inApp && <Badge badge={FrameBadge.IN_APP} />}
              {this.renderGroupingBadges()}
            </FrameBadges>
            {this.renderExpander()}
          </FrameLine>
        </StrictClick>
      );
    }

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
                isHoverPreviewed={isHoverPreviewed}
              >
                {!isHoverPreviewed && (
                  <PackageStatus
                    status={packageStatus}
                    tooltip={t('Go to Images Loaded')}
                  />
                )}
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
                isHoverPreviewed={isHoverPreviewed}
              />
            )}
            <Symbol
              frame={data}
              showCompleteFunctionName={!!showCompleteFunctionName}
              onFunctionNameToggle={onFunctionNameToggle}
              isHoverPreviewed={isHoverPreviewed}
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
      <StyledLi {...props} hasGroupingTreeUI={this.props.hasGroupingTreeUI}>
        {this.renderLine()}
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
          expandable={this.isExpandable()}
          isExpanded={this.state.isExpanded}
        />
      </StyledLi>
    );
  }
}

export default withOrganization(
  withSentryAppComponents(Line, {componentType: 'stacktrace-link'})
);

const FrameBadges = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  justify-content: flex-end;

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    grid-auto-flow: column;
  }
`;

const FrameLine = styled('div')<{hasAtLeastOneExpandableFrame?: boolean}>`
  display: grid;
  grid-template-columns: ${p =>
    p.hasAtLeastOneExpandableFrame
      ? '1fr 0.8fr 0.5fr minmax(24px, auto);'
      : '1fr 0.8fr 0.5fr'};
  grid-gap: ${space(0.75)};
  padding: ${space(0.5)} 15px !important;

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    grid-template-columns: ${p =>
      p.hasAtLeastOneExpandableFrame
        ? '150px minmax(117px, auto) 1fr 0.5fr minmax(24px, auto)'
        : '150px minmax(117px, auto) 1fr 0.5fr'};
  }

  @media (min-width: ${props => props.theme.breakpoints[2]}) and (max-width: ${props =>
      props.theme.breakpoints[3]}) {
    grid-template-columns: ${p =>
      p.hasAtLeastOneExpandableFrame
        ? '140px minmax(117px, auto) 1fr 0.5fr minmax(24px, auto)'
        : '140px minmax(117px, auto) 1fr 0.5fr'};
  }
`;

const FramePackageInfo = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: flex-start;

  ${PackageName} {
    max-width: 100%;
  }

  ${Package} {
    overflow: hidden;
    max-width: 100%;
    padding: 0;
  }
`;

const StyledTogglableAddress = styled(TogglableAddress)`
  order: 0;
  align-items: flex-start;
`;

const StyledSymbol = styled(Symbol)`
  order: 0;
  ${FunctionNameToggleIcon} {
    display: block;
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-row-start: 2;
  }
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

const NativeLineContent = styled('div')<{isFrameAfterLastNonApp: boolean}>`
  display: grid;
  flex: 1;
  grid-gap: ${space(0.5)};
  grid-template-columns: ${p =>
    `minmax(${p.isFrameAfterLastNonApp ? '167px' : '117px'}, auto)  1fr`};
  align-items: center;
  justify-content: flex-start;

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    grid-template-columns:
      ${p => (p.isFrameAfterLastNonApp ? '200px' : '150px')} minmax(117px, auto)
      1fr;
  }

  @media (min-width: ${props => props.theme.breakpoints[2]}) and (max-width: ${props =>
      props.theme.breakpoints[3]}) {
    grid-template-columns:
      ${p => (p.isFrameAfterLastNonApp ? '180px' : '140px')} minmax(117px, auto)
      1fr;
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

const StyledLi = styled('li')<{hasGroupingTreeUI?: boolean}>`
  ${p => p.hasGroupingTreeUI && `overflow: hidden;`}

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
