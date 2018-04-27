import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import _ from 'lodash';
import classNames from 'classnames';

import ClippedBox from 'app/components/clippedBox';
import Tooltip from 'app/components/tooltip';
import StrictClick from 'app/components/strictClick';
import Truncate from 'app/components/truncate';
import {t} from 'app/locale';
import {defined, objectIsEmpty, isUrl} from 'app/utils';

import ContextLine from 'app/components/events/interfaces/contextLine';
import FrameVariables from 'app/components/events/interfaces/frameVariables';

export function trimPackage(pkg) {
  let pieces = pkg.split(/^[a-z]:\\/i.test(pkg) ? '\\' : '/');
  let filename = pieces[pieces.length - 1] || pieces[pieces.length - 2] || pkg;
  return filename.replace(/\.(dylib|so|a|dll|exe)$/, '');
}

const Frame = createReactClass({
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

  isExpandable() {
    return (
      (!this.props.isOnlyFrame && this.props.emptySourceNotation) ||
      this.hasContextSource() ||
      this.hasContextVars()
    );
  },

  renderOriginalSourceInfo() {
    let data = this.props.data;

    let sourceMapText = t('Source Map');

    let out = `
    <div>
      <strong>${sourceMapText}</strong><br/>`;

    // mapUrl not always present; e.g. uploaded source maps
    if (data.mapUrl) out += `${_.escape(data.mapUrl)}<br/>`;
    else out += `${_.escape(data.map)}<br/>`;

    out += '</div>';

    return out;
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

  renderDefaultTitle() {
    let data = this.props.data;
    let title = [];

    // TODO(dcramer): this needs to use a formatted string so it can be
    // localized correctly

    if (defined(data.filename || data.module)) {
      // prioritize module name for Java as filename is often only basename
      let shouldPrioritizeModuleName = this.shouldPrioritizeModuleName();
      let pathName = shouldPrioritizeModuleName
        ? data.module || data.filename
        : data.filename || data.module;

      title.push(
        <code key="filename" className="filename">
          <Truncate value={pathName} maxLength={100} leftTrim={true} />
        </code>
      );

      // in case we prioritized the module name but we also have a filename info
      // we want to show a litle (?) icon that on hover shows the actual filename
      if (shouldPrioritizeModuleName && data.filename) {
        title.push(
          <Tooltip title={_.escape(data.filename)} tooltipOptions={{html: true}}>
            <a className="in-at real-filename">
              <span className="icon-question" />
            </a>
          </Tooltip>
        );
      }

      if (isUrl(data.absPath)) {
        title.push(
          <a
            href={data.absPath}
            className="icon-open"
            key="share"
            target="_blank"
            onClick={this.preventCollapse}
          />
        );
      }
      if (defined(data.function)) {
        title.push(
          <span className="in-at" key="in">
            {' '}
            in{' '}
          </span>
        );
      }
    }

    if (defined(data.function)) {
      title.push(
        <code key="function" className="function">
          {data.function}
        </code>
      );
    }

    // we don't want to render out zero line numbers which are used to
    // indicate lack of source information for native setups.  We could
    // TODO(mitsuhiko): only do this for events from native platforms?
    if (defined(data.lineNo) && data.lineNo != 0) {
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
        <Tooltip
          key="info-tooltip"
          title={this.renderOriginalSourceInfo()}
          tooltipOptions={{html: true}}
        >
          <a className="in-at original-src">
            <span className="icon-question" />
          </a>
        </Tooltip>
      );
    }

    title.push(this.renderExpander());

    return title;
  },

  renderContext() {
    let data = this.props.data;
    let context = '';
    let {isExpanded} = this.state;

    let outerClassName = 'context';
    if (isExpanded) {
      outerClassName += ' expanded';
    }

    let hasContextSource = this.hasContextSource();
    let hasContextVars = this.hasContextVars();
    let expandable = this.isExpandable();

    let contextLines = isExpanded
      ? data.context
      : data.context && data.context.filter(l => l[0] === data.lineNo);

    if (hasContextSource || hasContextVars) {
      let startLineNo = hasContextSource ? data.context[0][0] : '';
      context = (
        <ol start={startLineNo} className={outerClassName}>
          {defined(data.errors) && (
            <li className={expandable ? 'expandable error' : 'error'} key="errors">
              {data.errors.join(', ')}
            </li>
          )}

          {data.context &&
            contextLines.map((line, index) => {
              return (
                <ContextLine key={index} line={line} isActive={data.lineNo === line[0]} />
              );
            })}

          {hasContextVars && (
            <ClippedBox clipHeight={100}>
              <FrameVariables data={data.vars} key="vars" />
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
      this.getPlatform() == (this.props.prevFrame.platform || this.props.platform) &&
      this.props.data.instructionAddr == this.props.prevFrame.instructionAddr
    );
  },

  getFrameHint() {
    if (this.isInlineFrame()) {
      return t('Inlined frame');
    }
    if (this.getPlatform() == 'cocoa') {
      let func = this.props.data.function || '<unknown>';
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
    } else return null;
  },

  renderRepeats() {
    let timesRepeated = this.props.timesRepeated;
    if (timesRepeated > 0) {
      return (
        <span
          className="repeated-frames"
          title={`Frame repeated ${timesRepeated} time${timesRepeated === 1 ? '' : 's'}`}
        >
          <span className="icon-refresh" />
          <span>{timesRepeated}</span>
        </span>
      );
    } else return null;
  },

  renderDefaultLine() {
    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : null}>
        <div className="title">
          {this.renderLeadHint()}
          {this.renderDefaultTitle()}
          {this.renderRepeats()}
        </div>
      </StrictClick>
    );
  },

  renderNativeLine() {
    let data = this.props.data;
    let hint = this.getFrameHint();
    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : null}>
        <div className="title as-table">
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
            <code>{data.function || '<unknown>'}</code>{' '}
            {data.filename && (
              <span className="filename">
                {data.filename}
                {data.lineNo ? ':' + data.lineNo : ''}
              </span>
            )}
            {hint !== null ? (
              <a key="inline" className="tip" data-title={_.escape(hint)}>
                {' '}
                <span className="icon-question" />
              </a>
            ) : null}
            {this.renderExpander()}
          </span>
        </div>
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
    let data = this.props.data;
    let className = classNames({
      frame: true,
      'is-expandable': this.isExpandable(),
      expanded: this.state.isExpanded,
      collapsed: !this.state.isExpanded,
      'system-frame': !data.inApp,
      'frame-errors': data.errors,
      'leads-to-app': this.leadsToApp(),
      [this.getPlatform()]: true,
    });
    let props = {className};

    let context = this.renderContext();

    return (
      <li {...props}>
        {this.renderLine()}
        {context}
      </li>
    );
  },
});

export default Frame;
