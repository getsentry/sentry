import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import scrollToElement from 'scroll-to-element';

import styled from '@emotion/styled';
import {defined, objectIsEmpty} from 'app/utils';
import {t} from 'app/locale';
import TogglableAddress from 'app/components/events/interfaces/togglableAddress';
import PackageLink from 'app/components/events/interfaces/packageLink';
import PackageStatus from 'app/components/events/interfaces/packageStatus';
import StrictClick from 'app/components/strictClick';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import withSentryAppComponents from 'app/utils/withSentryAppComponents';
import {DebugMetaActions} from 'app/stores/debugMetaStore';
import {SymbolicatorStatus} from 'app/components/events/interfaces/types';
import InlineSvg from 'app/components/inlineSvg';
import {combineStatus} from 'app/components/events/interfaces/debugmeta';
import {IconRefresh} from 'app/icons/iconRefresh';

import FrameDefaultTitle from './frameDefaultTitle';
import FrameContext from './frameContext';
import FrameFunctionName from './frameFunctionName';
import {getPlatform} from './utils';

export class Frame extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    nextFrame: PropTypes.object,
    prevFrame: PropTypes.object,
    platform: PropTypes.string,
    isExpanded: PropTypes.bool,
    emptySourceNotation: PropTypes.bool,
    isOnlyFrame: PropTypes.bool,
    timesRepeated: PropTypes.number,
    registers: PropTypes.objectOf(PropTypes.string.isRequired),
    components: PropTypes.array.isRequired,
    showingAbsoluteAddress: PropTypes.bool,
    onAddressToggle: PropTypes.func,
    image: PropTypes.object,
    maxLengthOfRelativeAddress: PropTypes.number,
  };

  static defaultProps = {
    isExpanded: false,
    emptySourceNotation: false,
  };

  // isExpanded can be initialized to true via parent component;
  // data synchronization is not important
  // https://facebook.github.io/react/tips/props-in-getInitialState-as-anti-pattern.html
  state = {
    isExpanded: this.props.isExpanded,
  };

  toggleContext = evt => {
    evt && evt.preventDefault();

    this.setState({
      isExpanded: !this.state.isExpanded,
    });
  };

  hasContextSource() {
    return defined(this.props.data.context) && this.props.data.context.length;
  }

  hasContextVars() {
    return !objectIsEmpty(this.props.data.vars);
  }

  hasContextRegisters() {
    return !objectIsEmpty(this.props.registers);
  }

  hasAssembly() {
    return this.getPlatform() === 'csharp' && defined(this.props.data.package);
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
    // of the stacktrace / exception
    return getPlatform(this.props.data.platform, this.props.platform);
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

    return symbolicatorStatus && symbolicatorStatus !== SymbolicatorStatus.UNKNOWN_IMAGE;
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
    DebugMetaActions.updateFilter(this.props.data.instructionAddr);
    scrollToElement('#packages');
  };

  preventCollapse = evt => {
    evt.stopPropagation();
  };

  renderExpander() {
    if (!this.isExpandable()) {
      return null;
    }
    return (
      <a
        key="expander"
        title={t('Toggle context')}
        onClick={this.toggleContext}
        className="btn btn-sm btn-default btn-toggle"
        css={this.getPlatform() === 'csharp' && {display: 'block !important'}} // remove important once we get rid of css files
      >
        <span className={this.state.isExpanded ? 'icon-minus' : 'icon-plus'} />
      </a>
    );
  }

  leadsToApp() {
    return !this.props.data.inApp && this.props.nextFrame && this.props.nextFrame.inApp;
  }

  isFoundByStackScanning() {
    const {data} = this.props;

    return data.trust === 'scan' || data.trust === 'cfi-scan';
  }

  getFrameHint() {
    // returning [hintText, hintType]
    const {symbolicatorStatus} = this.props.data;
    const func = this.props.data.function || '<unknown>';
    const warningType = 'question';
    const errorType = 'exclamation';

    if (func.match(/^@objc\s/)) {
      return [t('Objective-C -> Swift shim frame'), warningType];
    }
    if (func.match(/^__?hidden#\d+/)) {
      return [t('Hidden function from bitcode build'), errorType];
    }
    if (!symbolicatorStatus && func === '<unknown>') {
      // Only render this if the event was not symbolicated.
      return [t('No function name was supplied by the client SDK.'), warningType];
    }

    if (
      func === '<unknown>' ||
      (func === '<redacted>' && symbolicatorStatus === SymbolicatorStatus.MISSING_SYMBOL)
    ) {
      switch (symbolicatorStatus) {
        case SymbolicatorStatus.MISSING_SYMBOL:
          return [t('The symbol was not found within the debug file.'), warningType];
        case SymbolicatorStatus.UNKNOWN_IMAGE:
          return [t('No image is specified for the address of the frame.'), warningType];
        case SymbolicatorStatus.MISSING:
          return [
            t('The debug file could not be retrieved from any of the sources.'),
            errorType,
          ];
        case SymbolicatorStatus.MALFORMED:
          return [t('The retrieved debug file could not be processed.'), errorType];
        default:
      }
    }

    if (func === '<redacted>') {
      return [t('Unknown system frame. Usually from beta SDKs'), warningType];
    }

    return [null, null];
  }

  renderLeadHint() {
    if (this.leadsToApp() && !this.state.isExpanded) {
      return <span className="leads-to-app-hint">{'Called from: '}</span>;
    } else {
      return null;
    }
  }

  renderRepeats() {
    const timesRepeated = this.props.timesRepeated;
    if (timesRepeated > 0) {
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
    } else {
      return null;
    }
  }

  renderDefaultLine() {
    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : null}>
        <DefaultLine className="title">
          <VertCenterWrapper>
            <div>
              {this.renderLeadHint()}
              <FrameDefaultTitle frame={this.props.data} platform={this.props.platform} />
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
      image,
      maxLengthOfRelativeAddress,
    } = this.props;
    const [hint, hintType] = this.getFrameHint();

    const enablePathTooltip = defined(data.absPath) && data.absPath !== data.filename;

    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : null}>
        <DefaultLine className="title as-table">
          <NativeLineContent>
            {this.renderLeadHint()}
            <PackageLink
              packagePath={data.package}
              onClick={this.scrollToImage}
              isClickable={this.shouldShowLinkToImage()}
            >
              <PackageStatus status={this.packageStatus()} />
            </PackageLink>
            <TogglableAddress
              address={data.instructionAddr}
              startingAddress={image ? image.image_addr : null}
              isAbsolute={showingAbsoluteAddress}
              isFoundByStackScanning={this.isFoundByStackScanning()}
              isInlineFrame={this.isInlineFrame()}
              onToggle={onAddressToggle}
              maxLengthOfRelativeAddress={maxLengthOfRelativeAddress}
            />
            <Symbol className="symbol">
              <FrameFunctionName frame={data} />{' '}
              {hint !== null ? (
                <Tooltip title={hint}>
                  <HintStatus
                    src={`icon-circle-${hintType}`}
                    danger={hintType === 'exclamation'}
                    size="1em"
                  />
                </Tooltip>
              ) : null}
              {data.filename && (
                <Tooltip title={data.absPath} disabled={!enablePathTooltip}>
                  <span className="filename">
                    {data.filename}
                    {data.lineNo ? ':' + data.lineNo : ''}
                  </span>
                </Tooltip>
              )}
            </Symbol>
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
      [this.getPlatform()]: true,
    });
    const props = {className};

    return (
      <li {...props}>
        {this.renderLine()}
        <FrameContext
          frame={data}
          registers={this.props.registers}
          components={this.props.components}
          hasContextSource={this.hasContextSource()}
          hasContextVars={this.hasContextVars()}
          hasContextRegisters={this.hasContextRegisters()}
          emptySourceNotation={this.props.emptySourceNotation}
          hasAssembly={this.hasAssembly()}
          expandable={this.isExpandable()}
          isExpanded={this.state.isExpanded}
        />
      </li>
    );
  }
}

const RepeatedFrames = styled('div')`
  display: inline-block;
  border-radius: 50px;
  padding: 1px 3px;
  margin-left: ${space(1)};
  border-width: thin;
  border-style: solid;
  border-color: ${p => p.theme.yellowOrangeDark};
  color: ${p => p.theme.yellowOrangeDark};
  background-color: ${p => p.theme.whiteDark};
  white-space: nowrap;
`;

const VertCenterWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const RepeatedContent = styled(VertCenterWrapper)`
  justify-content: center;
`;

const NativeLineContent = styled(VertCenterWrapper)`
  flex: 1;
  overflow: hidden;
  justify-content: center;

  & > span {
    display: block;
    padding: 0 5px;
  }

  flex-direction: column;
  @media (min-width: ${props => props.theme.breakpoints[2]}) {
    flex-direction: row;
  }
`;

const DefaultLine = styled(VertCenterWrapper)`
  justify-content: space-between;
`;

const HintStatus = styled(InlineSvg)`
  margin: 0 ${space(0.75)} 0 -${space(0.25)};
  color: ${p => (p.danger ? p.theme.alert.error.iconColor : '#2c58a8')};
  transform: translateY(-1px);
`;

const Symbol = styled('span')`
  text-align: center;
  @media (min-width: ${props => props.theme.breakpoints[2]}) {
    text-align: left;
  }
`;

const StyledIconRefresh = styled(IconRefresh)`
  margin-right: ${space(0.25)};
`;

export default withSentryAppComponents(Frame, {componentType: 'stacktrace-link'});
