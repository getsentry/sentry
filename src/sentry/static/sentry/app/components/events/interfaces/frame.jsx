import React from "react";
import _ from "underscore";
import classNames from "classnames";
import {defined, objectIsEmpty, isUrl} from "../../../utils";

import TooltipMixin from "../../../mixins/tooltip";
import FrameVariables from "./frameVariables";


var Frame = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  mixins: [
    TooltipMixin({
      html: true,
      selector: ".tip",
      trigger: "click"
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

  renderOriginalSourceInfo() {
    let data = this.props.data;

    // TODO: is there a way to render a react element as a string? All the
    // documented methods don't exist on the client (meant for server rendering)
    let escapedAbsPath = isUrl(data.origAbsPath)
      ? `<a href="${_.escape(data.origAbsPath)}">${_.escape(data.origAbsPath)}</a>`
      : _.escape(data.origAbsPath);

    let out = `
    <div>
      <strong>Original Filename</strong><br/>
      ${escapedAbsPath}<br/>
      <strong>Line Number</strong><br/>
      ${_.escape(data.origLineNo)}<br/>
      <strong>Column Number</strong><br/>
      ${_.escape(data.origColNo)}<br/>
      <strong>Function</strong><br/>
      ${_.escape(data.origFunction)}<br/>
      <strong>Source Map</strong><br/>`;

    // mapUrl not always present; e.g. uploaded source maps
    out += data.mapUrl
      ? `<a href="${_.escape(data.mapUrl)}">${_.escape(data.map)}<br/>`
      : `${_.escape(data.map)}<br/>`;

    out += '</div>';

    return out;
  },

  renderTitle() {
    let data = this.props.data;
    let title = [];

    if (defined(data.filename || data.module)) {
      title.push(<code key="filename">{data.filename || data.module}</code>);
      if (isUrl(data.absPath)) {
        title.push(<a href={data.absPath} className="icon-open" key="share" target="_blank" />);
      }
      if (defined(data.function)) {
        title.push(<span className="in-at" key="in"> in </span>);
      }
    }

    if (defined(data.function)) {
      title.push(<code key="function">{data.function}</code>);
    }

    if (defined(data.lineNo)) {
      // TODO(dcramer): we need to implement source mappings
      // title.push(<span className="pull-right blame"><a><span className="icon-mark-github"></span> View Code</a></span>);
      title.push(<span className="in-at" key="at"> at line </span>);
      if (defined(data.colNo)) {
        title.push(<code key="line">{data.lineNo}:{data.colNo}</code>);
      } else {
        title.push(<code key="line">{data.lineNo}</code>);
      }
    }

    if (defined(data.origAbsPath)) {
      title.push(
        <a key="original-src" className="in-at tip original-src" title={this.renderOriginalSourceInfo()}>
          <span className="icon-question" />
        </a>
      );
    }

    if (data.inApp) {
      title.push(<span key="in-app"><span className="divider"/>application</span>);
    }
    return title;
  },

  renderContext() {
    let data = this.props.data;
    let context = '';

    let outerClassName = "context";
    if (this.state.isExpanded) {
      outerClassName += " expanded";
    }

    let hasContextSource = defined(data.context) && data.context.length;
    let hasExtendedSource = hasContextSource && data.context.length > 1;
    let hasContextVars = !objectIsEmpty(data.vars);
    let expandable = hasExtendedSource || hasContextVars;

    if (hasContextSource || hasContextVars) {
      let startLineNo = hasContextSource ? data.context[0][0] : '';
      context = (
        <ol start={startLineNo} className={outerClassName}
            onClick={this.toggleContext}>
          {defined(data.errors) &&
          <li className={expandable ? "expandable error" : "error"}
              key="errors">{data.errors.join(", ")}</li>
          }
          {(data.context || []).map((line) => {
            let liClassName = "expandable";
            if (line[0] === data.lineNo) {
              liClassName += " active";
            }

            let lineWs;
            let lineCode;
            if (defined(line[1])) {
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

  render() {
    let data = this.props.data;

    let className = classNames({
      "frame": true,
      "system-frame": !data.inApp,
      "frame-errors": data.errors,
    });

    let context = this.renderContext();

    return (
      <li className={className}>
        <p>{this.renderTitle()}
          {context ?
            <a
              title="Toggle context"
              onClick={this.toggleContext}
              className="btn btn-sm btn-default btn-toggle">
              <span className={this.state.isExpanded ? "icon-minus" : "icon-plus"}/>
            </a>
            : ''
          }
        </p>
        {context}
      </li>
    );
  }
});

export default Frame;
