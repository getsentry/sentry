import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import createReactClass from 'create-react-class';
import styled, {css} from 'react-emotion';

import {defined, objectIsEmpty, isUrl} from 'app/utils';
import {t} from 'app/locale';
import ClippedBox from 'app/components/clippedBox';
import ContextLine from 'app/components/events/interfaces/contextLine';
import ExternalLink from 'app/components/links/externalLink';
import FrameRegisters from 'app/components/events/interfaces/frameRegisters';
import FrameVariables from 'app/components/events/interfaces/frameVariables';
import StrictClick from 'app/components/strictClick';
import Tooltip from 'app/components/tooltip';
import Truncate from 'app/components/truncate';
import OpenInContextLine from 'app/components/events/interfaces/openInContextLine';
import space from 'app/styles/space';
import ErrorBoundary from 'app/components/errorBoundary';
import withSentryAppComponents from 'app/utils/withSentryAppComponents';

export function trimPackage(pkg) {
  const pieces = pkg.split(/^([a-z]:\\|\\\\)/i.test(pkg) ? '\\' : '/');
  const filename = pieces[pieces.length - 1] || pieces[pieces.length - 2] || pkg;
  return filename.replace(/\.(dylib|so|a|dll|exe)$/, '');
}

class FunctionName extends React.Component {
  static propTypes = {
    frame: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      rawFunction: false,
    };
  }

  toggle = event => {
    event.stopPropagation();
    this.setState(({rawFunction}) => ({rawFunction: !rawFunction}));
  };

  render() {
    const {frame, ...props} = this.props;
    const func = frame.function;
    const rawFunc = frame.rawFunction;
    const canToggle = rawFunc && func && func !== rawFunc;

    if (!canToggle) {
      return <code {...props}>{func || rawFunc || '<unknown>'}</code>;
    }

    const current = this.state.rawFunction ? rawFunc : func;
    const title = this.state.rawFunction ? null : rawFunc;
    return (
      <code {...props} title={title}>
        <a onClick={this.toggle}>{current || '<unknown>'}</a>
      </code>
    );
  }
}

export const Frame = createReactClass({
  displayName: 'Frame',

  propTypes: {
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
  },

  getDefaultProps() {
    return {
      isExpanded: false,
      emptySourceNotation: false,
    };
  },

  getInitialState() {
    // isExpanded can be initialized to true via parent component;
    // data synchronization is not important
    // https://facebook.github.io/react/tips/props-in-getInitialState-as-anti-pattern.html
    return {
      isExpanded: this.props.isExpanded,
    };
  },

  toggleContext(evt) {
    evt && evt.preventDefault();

    this.setState({
      isExpanded: !this.state.isExpanded,
    });
  },

  hasContextSource() {
    return defined(this.props.data.context) && this.props.data.context.length;
  },

  hasContextVars() {
    return !objectIsEmpty(this.props.data.vars);
  },

  hasContextRegisters() {
    return !objectIsEmpty(this.props.registers);
  },

  isExpandable() {
    return (
      (!this.props.isOnlyFrame && this.props.emptySourceNotation) ||
      this.hasContextSource() ||
      this.hasContextVars() ||
      this.hasContextRegisters()
    );
  },

  renderOriginalSourceInfo() {
    const data = this.props.data;

    // mapUrl not always present; e.g. uploaded source maps
    return (
      <React.Fragment>
        <strong>{t('Source Map')}</strong>
        <br />
        {data.mapUrl ? data.mapUrl : data.map}
        <br />
      </React.Fragment>
    );
  },

  getPlatform() {
    // prioritize the frame platform but fall back to the platform
    // of the stacktrace / exception
    return this.props.data.platform || this.props.platform;
  },

  shouldPrioritizeModuleName() {
    switch (this.getPlatform()) {
      case 'java':
      case 'csharp':
        return true;
      default:
        return false;
    }
  },

  preventCollapse(evt) {
    evt.stopPropagation();
  },

  getSentryAppComponents() {
    return this.props.components;
  },

  renderDefaultTitle() {
    const data = this.props.data;
    const title = [];

    // TODO(dcramer): this needs to use a formatted string so it can be
    // localized correctly

    if (defined(data.filename || data.module)) {
      // prioritize module name for Java as filename is often only basename
      const shouldPrioritizeModuleName = this.shouldPrioritizeModuleName();
      const pathName = shouldPrioritizeModuleName
        ? data.module || data.filename
        : data.filename || data.module;

      title.push(
        <Tooltip title={data.absPath} disabled={!defined(data.absPath)}>
          <code key="filename" className="filename">
            <Truncate value={pathName} maxLength={100} leftTrim={true} />
          </code>
        </Tooltip>
      );

      // in case we prioritized the module name but we also have a filename info
      // we want to show a litle (?) icon that on hover shows the actual filename
      if (shouldPrioritizeModuleName && data.filename) {
        title.push(
          <Tooltip title={data.filename}>
            <a className="in-at real-filename">
              <span className="icon-question" />
            </a>
          </Tooltip>
        );
      }

      if (isUrl(data.absPath)) {
        title.push(
          <ExternalLink
            href={data.absPath}
            className="icon-open"
            key="share"
            onClick={this.preventCollapse}
          />
        );
      }
      if (defined(data.function) || defined(data.rawFunction)) {
        title.push(
          <span className="in-at" key="in">
            {' '}
            in{' '}
          </span>
        );
      }
    }

    if (defined(data.function) || defined(data.rawFunction)) {
      title.push(<FunctionName frame={data} key="function" className="function" />);
    }

    // we don't want to render out zero line numbers which are used to
    // indicate lack of source information for native setups.  We could
    // TODO(mitsuhiko): only do this for events from native platforms?
    if (defined(data.lineNo) && data.lineNo !== 0) {
      title.push(
        <span className="in-at in-at-line" key="no">
          {' '}
          at line{' '}
        </span>
      );
      title.push(
        <code key="line" className="lineno">
          {defined(data.colNo) ? `${data.lineNo}:${data.colNo}` : data.lineNo}
        </code>
      );
    }

    if (defined(data.package)) {
      title.push(
        <span className="within" key="within">
          {' '}
          within{' '}
        </span>
      );
      title.push(
        <code title={data.package} className="package" key="package">
          {trimPackage(data.package)}
        </code>
      );
    }

    if (defined(data.origAbsPath)) {
      title.push(
        <Tooltip key="info-tooltip" title={this.renderOriginalSourceInfo()}>
          <a className="in-at original-src">
            <span className="icon-question" />
          </a>
        </Tooltip>
      );
    }

    return title;
  },

  renderContext() {
    const data = this.props.data;
    let context = '';
    const {isExpanded} = this.state;

    let outerClassName = 'context';
    if (isExpanded) {
      outerClassName += ' expanded';
    }

    const hasContextSource = this.hasContextSource();
    const hasContextVars = this.hasContextVars();
    const hasContextRegisters = this.hasContextRegisters();
    const expandable = this.isExpandable();

    const contextLines = isExpanded
      ? data.context
      : data.context && data.context.filter(l => l[0] === data.lineNo);

    if (hasContextSource || hasContextVars || hasContextRegisters) {
      const startLineNo = hasContextSource ? data.context[0][0] : '';
      context = (
        <ol start={startLineNo} className={outerClassName}>
          {defined(data.errors) && (
            <li className={expandable ? 'expandable error' : 'error'} key="errors">
              {data.errors.join(', ')}
            </li>
          )}

          {data.context &&
            contextLines.map((line, index) => {
              const isActive = data.lineNo === line[0];
              const components = this.getSentryAppComponents();
              const hasComponents = isActive && components.length > 0;
              const className = hasComponents
                ? css`
                    background: inherit;
                    padding: 0;
                    text-indent: 20px;
                    z-index: 1000;
                  `
                : css`
                    background: inherit;
                    padding: 0 20px;
                  `;
              return (
                <ContextLine
                  key={index}
                  line={line}
                  isActive={isActive}
                  className={className}
                >
                  {hasComponents && (
                    <ErrorBoundary mini>
                      <OpenInContextLine
                        key={index}
                        lineNo={line[0]}
                        filename={data.filename}
                        components={components}
                      />
                    </ErrorBoundary>
                  )}
                </ContextLine>
              );
            })}

          {(hasContextRegisters || hasContextVars) && (
            <ClippedBox clipHeight={100}>
              {hasContextRegisters && (
                <FrameRegisters data={this.props.registers} key="registers" />
              )}
              {hasContextVars && <FrameVariables data={data.vars} key="vars" />}
            </ClippedBox>
          )}
        </ol>
      );
    } else if (this.props.emptySourceNotation) {
      context = (
        <div className="empty-context">
          <span className="icon icon-exclamation" />
          <p>{t('No additional details are available for this frame.')}</p>
        </div>
      );
    }
    return context;
  },

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
      >
        <span className={this.state.isExpanded ? 'icon-minus' : 'icon-plus'} />
      </a>
    );
  },

  leadsToApp() {
    return !this.props.data.inApp && this.props.nextFrame && this.props.nextFrame.inApp;
  },

  isInlineFrame() {
    return (
      this.props.prevFrame &&
      this.getPlatform() === (this.props.prevFrame.platform || this.props.platform) &&
      this.props.data.instructionAddr === this.props.prevFrame.instructionAddr
    );
  },

  getFrameHint() {
    if (this.isInlineFrame()) {
      return t('Inlined frame');
    }
    if (this.props.data.trust === 'scan' || this.props.data.trust === 'cfi-scan') {
      return t('Found by stack scanning');
    }
    if (this.getPlatform() === 'cocoa') {
      const func = this.props.data.function || '<unknown>';
      if (func.match(/^@objc\s/)) {
        return t('Objective-C -> Swift shim frame');
      }
      if (func === '<redacted>') {
        return t('Unknown system frame. Usually from beta SDKs');
      }
      if (func.match(/^__?hidden#\d+/)) {
        return t('Hidden function from bitcode build');
      }
    }
    return null;
  },

  renderLeadHint() {
    if (this.leadsToApp() && !this.state.isExpanded) {
      return <span className="leads-to-app-hint">{'Called from: '}</span>;
    } else {
      return null;
    }
  },

  renderRepeats() {
    const timesRepeated = this.props.timesRepeated;
    if (timesRepeated > 0) {
      return (
        <RepeatedFrames
          title={`Frame repeated ${timesRepeated} time${timesRepeated === 1 ? '' : 's'}`}
        >
          <RepeatedContent>
            <span className="icon-refresh" />
            <span>{timesRepeated}</span>
          </RepeatedContent>
        </RepeatedFrames>
      );
    } else {
      return null;
    }
  },

  renderDefaultLine() {
    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : null}>
        <DefaultLine className="title">
          <VertCenterWrapper>
            <div>
              {this.renderLeadHint()}
              {this.renderDefaultTitle()}
            </div>
            {this.renderRepeats()}
          </VertCenterWrapper>
          {this.renderExpander()}
        </DefaultLine>
      </StrictClick>
    );
  },

  renderNativeLine() {
    const data = this.props.data;
    const hint = this.getFrameHint();
    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : null}>
        <DefaultLine className="title as-table">
          <NativeLineContent>
            {this.renderLeadHint()}
            {defined(data.package) ? (
              <span className="package" title={data.package}>
                {trimPackage(data.package)}
              </span>
            ) : (
              <span className="package">{'<unknown>'}</span>
            )}
            <span className="address">{data.instructionAddr}</span>
            <span className="symbol">
              <FunctionName frame={data} />{' '}
              {data.filename && (
                <Tooltip title={data.absPath} disabled={!defined(data.absPath)}>
                  <span
                    className="filename"
                    title={data.absPath !== data.filename ? data.absPath : null}
                  >
                    {data.filename}
                    {data.lineNo ? ':' + data.lineNo : ''}
                  </span>
                </Tooltip>
              )}
              {hint !== null ? (
                <Tooltip title={hint}>
                  <a key="inline">
                    <span className="icon-question" />
                  </a>
                </Tooltip>
              ) : null}
            </span>
          </NativeLineContent>
          {this.renderExpander()}
        </DefaultLine>
      </StrictClick>
    );
  },

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
  },

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

    const context = this.renderContext();

    return (
      <li {...props}>
        {this.renderLine()}
        {context}
      </li>
    );
  },
});

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

const NativeLineContent = styled(RepeatedContent)`
  flex: 1;
  overflow: hidden;

  & > span {
    display: block;
    padding: 0 5px;
  }
`;

const DefaultLine = styled(VertCenterWrapper)`
  justify-content: space-between;
`;

export default withSentryAppComponents(Frame, {componentType: 'stacktrace-link'});
