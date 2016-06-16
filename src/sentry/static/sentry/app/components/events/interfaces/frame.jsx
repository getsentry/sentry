import React from 'react';
import _ from 'underscore';
import classNames from 'classnames';

import ClippedBox from '../../../components/clippedBox';
import TooltipMixin from '../../../mixins/tooltip';
import StrictClick from '../../strictClick';
import Truncate from '../../../components/truncate';
import {t} from '../../../locale';
import {defined, objectIsEmpty, isUrl} from '../../../utils';

import ContextLine from './contextLine';
import FrameVariables from './frameVariables';

function trimPackage(pkg) {
  let pieces = pkg.split(/\//g);
  let rv = pieces[pieces.length - 1] || pieces[pieces.length - 2] || pkg;
  let match = rv.match(/^(.*?)\.(dylib|so|a)$/);
  return match && match[1] || rv;
}


const Frame = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    nextFrameInApp: React.PropTypes.bool,
    platform: React.PropTypes.string,
    isExpanded: React.PropTypes.bool,
  },

  mixins: [
    TooltipMixin({
      html: true,
      selector: '.tip',
      trigger: 'hover'
    })
  ],

  getDefaultProps() {
    return {
      isExpanded: false
    };
  },

  getInitialState() {
    // isExpanded can be initialized to true via parent component;
    // data synchronization is not important
    // https://facebook.github.io/react/tips/props-in-getInitialState-as-anti-pattern.html
    return {
      isExpanded: this.props.isExpanded
    };
  },

  toggleContext(evt) {
    evt && evt.preventDefault();

    this.setState({
      isExpanded: !this.state.isExpanded
    });
  },

  hasContextSource() {
    return defined(this.props.data.context) && this.props.data.context.length;
  },

  hasContextVars() {
    return !objectIsEmpty(this.props.data.vars);
  },

  isExpandable() {
    return this.hasContextSource() || this.hasContextVars();
  },

  renderOriginalSourceInfo() {
    let data = this.props.data;

    let sourceMapText = t('Source Map');

    let out = `
    <div>
      <strong>${sourceMapText}</strong><br/>`;

    // mapUrl not always present; e.g. uploaded source maps
    if (data.mapUrl)
      out += `${_.escape(data.mapUrl)}<br/>`;
    else
      out += `${_.escape(data.map)}<br/>`;

    out += '</div>';

    return out;
  },

  renderDefaultTitle() {
    let data = this.props.data;
    let title = [];

    // TODO(mitsuhiko): this is terrible for translators but i'm too
    // lazy to change this up right now.  This should be a format string

    if (defined(data.filename || data.module)) {
      title.push((
        <code key="filename" className="filename">
          <Truncate value={data.filename || data.module} maxLength={100} leftTrim={true} />
        </code>
      ));
      if (isUrl(data.absPath)) {
        title.push(<a href={data.absPath} className="icon-open" key="share" target="_blank" />);
      }
      if (defined(data.function)) {
        title.push(<span className="in-at" key="in"> {t('in')} </span>);
      }
    }

    if (defined(data.function)) {
      title.push(<code key="function" className="function">{data.function}</code>);
    }

    // we don't want to render out zero line numbers which are used to
    // indicate lack of source information for native setups.  We could
    // TODO(mitsuhiko): only do this for events from native platforms?
    else if (defined(data.lineNo) && data.lineNo != 0) {
      // TODO(dcramer): we need to implement source mappings
      // title.push(<span className="pull-right blame"><a><span className="icon-mark-github"></span> View Code</a></span>);
      title.push(<span className="in-at" key="at"> {t('at line')} </span>);
      if (defined(data.colNo)) {
        title.push(<code key="line" className="lineno">{data.lineNo}:{data.colNo}</code>);
      } else {
        title.push(<code key="line" className="lineno">{data.lineNo}</code>);
      }
    }

    if (defined(data.package)) {
      title.push(<span className="within" key="within"> {t('within')} </span>);
      title.push(<code title={data.package} className="package">{trimPackage(data.package)}</code>);
    }

    if (defined(data.origAbsPath)) {
      title.push(
        <a key="original-src" className="in-at tip original-src" data-title={this.renderOriginalSourceInfo()}>
          <span className="icon-question" />
        </a>
      );
    }

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
          {defined(data.errors) &&
          <li className={expandable ? 'expandable error' : 'error'}
              key="errors">{data.errors.join(', ')}</li>
          }

          {data.context && contextLines.map((line, index) => {
            return <ContextLine key={index} line={line} isActive={data.lineNo === line[0]} />;
          })}

          {hasContextVars &&
            <ClippedBox clipHeight={100}><FrameVariables data={data.vars} key="vars" /></ClippedBox>
          }
        </ol>
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
        title={t('Toggle context')}
        onClick={this.toggleContext}
        className="btn btn-sm btn-default btn-toggle">
        <span className={this.state.isExpanded ? 'icon-minus' : 'icon-plus'}/>
      </a>
    );
  },

  renderDefaultLine() {
    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : null}>
        <p>
          {this.renderDefaultTitle()}
          {this.renderExpander()}
        </p>
      </StrictClick>
    );
  },

  renderCocoaLine() {
    let data = this.props.data;
    return (
      <StrictClick onClick={this.isExpandable() ? this.toggleContext : null}>
        <p className="as-table">
          {defined(data.package)
            ? (
              <span className="package" title={data.package}>
                {trimPackage(data.package)}
              </span>
            ) : (
              <span className="package"/>
            )
          }
          <span className="address">
            {data.instructionAddr}
          </span>
          <span className="symbol">
            <code>{data.function || '<unknown>'}</code>
            {data.instructionOffset &&
              <span className="offset">{' + ' + data.instructionOffset}</span>}
            {data.filename &&
              <span className="filename">{data.filename}
                {data.lineNo ? ':' + data.lineNo : ''}</span>}
            {this.renderExpander()}
          </span>
        </p>
      </StrictClick>
    );
  },

  renderLine() {
    switch (this.props.platform) {
      case 'objc':
      case 'cocoa':
        return this.renderCocoaLine();
      default:
        return this.renderDefaultLine();
    }
  },

  render() {
    let data = this.props.data;

    let className = classNames({
      'frame': true,
      'is-expandable': this.isExpandable(),
      'expanded': this.state.isExpanded,
      'system-frame': !data.inApp,
      'frame-errors': data.errors,
      'leads-to-app': !data.inApp && this.props.nextFrameInApp
    });
    let props = {className: className};

    let context = this.renderContext();

    return (
      <li {...props}>
        {this.renderLine()}
        {context}
      </li>
    );
  }
});

export default Frame;
