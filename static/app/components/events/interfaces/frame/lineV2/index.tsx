import * as React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import DebugImage from 'app/components/events/interfaces/debugMeta/debugImage';
import {PackageStatusIcon} from 'app/components/events/interfaces/packageStatus';
import {AddressToggleIcon} from 'app/components/events/interfaces/togglableAddress';
import StrictClick from 'app/components/strictClick';
import {Frame, Organization, PlatformType, SentryAppComponent} from 'app/types';
import {Event} from 'app/types/event';
import withOrganization from 'app/utils/withOrganization';
import withSentryAppComponents from 'app/utils/withSentryAppComponents';

import Context from '../context';
import {FunctionNameToggleIcon} from '../symbol';
import {
  getPlatform,
  hasAssembly,
  hasContextRegisters,
  hasContextSource,
  hasContextVars,
  isExpandable,
} from '../utils';

import Default from './default';
import Native from './native';

type Props = {
  data: Frame;
  event: Event;
  registers: Record<string, string>;
  components: Array<SentryAppComponent>;
  haveFramesAtLeastOneExpandedFrame?: boolean;
  haveFramesAtLeastOneGroupingBadge?: boolean;
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

  toggleContext = (evt?: React.MouseEvent) => {
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

  leadsToApp() {
    const {data, nextFrame} = this.props;
    return !data.inApp && ((nextFrame && nextFrame.inApp) || !nextFrame);
  }

  renderLine() {
    const {
      data: frame,
      nextFrame,
      timesRepeated,
      isHoverPreviewed,
      platform = 'other',
      includeSystemFrames,
      onAddressToggle,
      onFunctionNameToggle,
      showingAbsoluteAddress,
      showCompleteFunctionName,
      isFrameAfterLastNonApp,
      isSentinel,
      isUsedForGrouping,
      isPrefix,
      haveFramesAtLeastOneExpandedFrame,
      haveFramesAtLeastOneGroupingBadge,
    } = this.props;
    const {isExpanded} = this.state;

    const leadsToApp = this.leadsToApp();
    const expandable = this.isExpandable();
    const hasGroupingBadge = isSentinel || isUsedForGrouping || isPrefix || frame.inApp;

    switch (this.getPlatform()) {
      case 'objc':
      // fallthrough
      case 'cocoa':
      // fallthrough
      case 'native':
        return (
          <StrictClick onClick={expandable ? this.toggleContext : undefined}>
            <Native
              frame={frame}
              nextFrame={nextFrame}
              isHoverPreviewed={isHoverPreviewed}
              leadsToApp={leadsToApp}
              platform={platform as PlatformType}
              isExpanded={isExpanded}
              isExpandable={expandable}
              onAddressToggle={onAddressToggle}
              onFunctionNameToggle={onFunctionNameToggle}
              includeSystemFrames={includeSystemFrames}
              showingAbsoluteAddress={showingAbsoluteAddress}
              showCompleteFunctionName={showCompleteFunctionName}
              isFrameAfterLastNonApp={isFrameAfterLastNonApp}
              onToggleContext={this.toggleContext}
              hasGroupingBadge={hasGroupingBadge}
              isSentinel={isSentinel}
              isPrefix={isPrefix}
              isUsedForGrouping={isUsedForGrouping}
              haveFramesAtLeastOneExpandedFrame={haveFramesAtLeastOneExpandedFrame}
              haveFramesAtLeastOneGroupingBadge={haveFramesAtLeastOneGroupingBadge}
            />
          </StrictClick>
        );
      default:
        return (
          <StrictClick onClick={expandable ? this.toggleContext : undefined}>
            <Default
              frame={frame}
              nextFrame={nextFrame}
              timesRepeated={timesRepeated}
              isHoverPreviewed={isHoverPreviewed}
              leadsToApp={leadsToApp}
              platform={platform as PlatformType}
              isExpanded={isExpanded}
              isExpandable={expandable}
              onToggleContext={this.toggleContext}
              hasGroupingBadge={hasGroupingBadge}
              isSentinel={isSentinel}
              isPrefix={isPrefix}
              isUsedForGrouping={isUsedForGrouping}
              haveFramesAtLeastOneExpandedFrame={haveFramesAtLeastOneExpandedFrame}
              haveFramesAtLeastOneGroupingBadge={haveFramesAtLeastOneGroupingBadge}
            />
          </StrictClick>
        );
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

const StyledLi = styled('li')`
  overflow: hidden;

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
