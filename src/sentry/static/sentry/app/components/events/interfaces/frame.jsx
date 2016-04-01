import React from 'react';
import _ from 'underscore';
import classNames from 'classnames';
import {defined, objectIsEmpty, isUrl} from '../../../utils';

import TooltipMixin from '../../../mixins/tooltip';
import FrameVariables from './frameVariables';
import {t} from '../../../locale';


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
      trigger: 'click'
    })
  ],

  getInitialState() {
    // isExpanded can be initialized to true via parent component;
    // data synchronization is not important
    // https://facebook.github.io/react/tips/props-in-getInitialState-as-anti-pattern.html
    return {
      isExpanded: defined(this.props.isExpanded) ? this.props.isExpanded : false
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

  hasExtendedSource() {
    return this.hasContextSource() && this.props.data.context.length > 1;
  },

  hasContextVars() {
    return !objectIsEmpty(this.props.data.vars);
  },

  isExpandable() {
    return this.hasExtendedSource() || this.hasContextVars();
  },


  renderOriginalSourceInfo() {
    let data = this.props.data;

    // TODO: is there a way to render a react element as a string? All the
    // documented methods don't exist on the client (meant for server rendering)
    let escapedAbsPath = isUrl(data.origAbsPath)
      ? `<a href="${_.escape(data.origAbsPath)}">${_.escape(data.origAbsPath)}</a>`
      : _.escape(data.origAbsPath);

    let originalFilenameText = t('Original Filename');
    let lineNumberText = t('Line Number');
    let columnNumberText = t('Column Number');
    let functionText = t('Function');
    let sourceMapText = t('Source Map');

    let out = `
    <div>
      <strong>${originalFilenameText}</strong><br/>
      ${escapedAbsPath}<br/>
      <strong>${lineNumberText}</strong><br/>
      ${_.escape(data.origLineNo)}<br/>
      <strong>${columnNumberText}</strong><br/>
      ${_.escape(data.origColNo)}<br/>
      <strong>${functionText}</strong><br/>
      ${_.escape(data.origFunction)}<br/>
      <strong>${sourceMapText}</strong><br/>`;

    // mapUrl not always present; e.g. uploaded source maps
    out += data.mapUrl
      ? `<a href="${_.escape(data.mapUrl)}">${_.escape(data.map)}<br/>`
      : `${_.escape(data.map)}<br/>`;

    out += '</div>';

    return out;
  },

  renderDefaultTitle() {
    let data = this.props.data;
    let title = [];

    // TODO(mitsuhiko): this is terrible for translators but i'm too
    // lazy to change this up right now.  This should be a format string

    if (defined(data.filename || data.module)) {
      title.push(<code key="filename">{data.filename || data.module}</code>);
      if (isUrl(data.absPath)) {
        title.push(<a href={data.absPath} className="icon-open" key="share" target="_blank" />);
      }
      if (defined(data.function)) {
        title.push(<span className="in-at" key="in"> {t('in')} </span>);
      }
    }

    if (defined(data.function)) {
      title.push(<code key="function">{data.function}</code>);
    }

    // we don't want to render out zero line numbers which are used to
    // indicate lack of source information for native setups.  We could
    // TODO(mitsuhiko): only do this for events from native platforms?
    if (defined(data.lineNo) && data.lineNo != 0) {
      // TODO(dcramer): we need to implement source mappings
      // title.push(<span className="pull-right blame"><a><span className="icon-mark-github"></span> View Code</a></span>);
      title.push(<span className="in-at" key="at"> {t('at line')} </span>);
      if (defined(data.colNo)) {
        title.push(<code key="line">{data.lineNo}:{data.colNo}</code>);
      } else {
        title.push(<code key="line">{data.lineNo}</code>);
      }
    }

    if (defined(data.package)) {
      title.push(<span className="within" key="within"> {t('within')} </span>);
      title.push(<code>{data.package}</code>);
    }

    if (defined(data.origAbsPath)) {
      title.push(
        <a key="original-src" className="in-at tip original-src" data-title={this.renderOriginalSourceInfo()}>
          <span className="icon-question" />
        </a>
      );
    }

    if (data.inApp) {
      title.push(<span key="in-app"><span className="divider"/>{t('application')}</span>);
    }
    return title;
  },

  renderContext() {
    let data = this.props.data;
    let context = '';

    let outerClassName = 'context';
    if (this.state.isExpanded) {
      outerClassName += ' expanded';
    }

    let hasContextSource = this.hasContextSource();
    let hasContextVars = this.hasContextVars();
    let expandable = this.isExpandable();

    if (hasContextSource || hasContextVars) {
      let startLineNo = hasContextSource ? data.context[0][0] : '';
      context = (
        <ol start={startLineNo} className={outerClassName}
            onClick={expandable ? this.toggleContext : null}>
          {defined(data.errors) &&
          <li className={expandable ? 'expandable error' : 'error'}
              key="errors">{data.errors.join(', ')}</li>
          }
          {(data.context || []).map((line) => {
            let liClassName = 'expandable';
            if (line[0] === data.lineNo) {
              liClassName += ' active';
            }

            let lineWs;
            let lineCode;
            if (defined(line[1]) && line[1].match) {
              [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m);
            } else {
              lineWs = '';
              lineCode = '';
            }
            return (
              <li className={liClassName} key={line[0]}>
                <span className="ws">{
                lineWs}</span><span className="contextline">{lineCode
                }</span>
              </li>
            );
          })}

          {hasContextVars &&
            <FrameVariables data={data.vars} key="vars" />
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
      <p>
        {this.renderDefaultTitle()}
        {this.renderExpander()}
      </p>
    );
  },

  renderCocoaLine() {
    let data = this.props.data;
    let className = 'stacktrace-table';
    return (
      <div className={className}>
        <div className="trace-col package">
          {data.package}
        </div>
        <div className="trace-col address">
          {data.instructionAddr}
        </div>
        <div className="trace-col symbol">
          <code>{data.function || '<unknown>'}</code>
          {data.instructionOffset &&
            <span className="offset">{' + ' + data.instructionOffset}</span>}
          {data.filename &&
            <span className="filename">{data.filename}
              {data.lineNo ? ':' + data.lineNo : ''}</span>}
          {this.renderExpander()}
        </div>
      </div>
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
