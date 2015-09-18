import React from "react";
import classNames from "classnames";
import {defined, objectIsEmpty} from "../../../utils";

import TooltipMixin from "../../../mixins/tooltip";
import FrameVariables from "./frameVariables";

var Frame = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  mixins: [
    TooltipMixin({
      selector: ".expand-button"
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

  isUrl(filename) {
    if (!filename) {
      return false;
    }
    return filename.indexOf('http:') !== -1 || filename.indexOf('https:') !== -1;
  },

  toggleContext(evt) {
    evt && evt.preventDefault();
    this.setState({
      isExpanded: !this.state.isExpanded
    });
  },

  render() {
    var data = this.props.data;

    var className = classNames({
      "frame": true,
      "system-frame": !data.inApp,
      "frame-errors": data.errors,
    });

    var title = [];

    if (defined(data.filename || data.module)) {
      title.push(<code key="filename">{data.filename || data.module}</code>);
      if (this.isUrl(data.absPath)) {
        title.push(<a href={data.absPath} className="icon-share" key="share" />);
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

    if (data.inApp) {
      title.push(<span key="in-app"><span className="divider"/>application</span>);
    }

    var outerClassName = "context";
    if (this.state.isExpanded) {
      outerClassName += " expanded";
    }

    let context = '';

    // delete data.context;

    if (defined(data.context) && data.context.length || !objectIsEmpty(data.vars)) {
      var startLineNo = defined(data.context) ? data.context[0][0] : '';
      context = (
        <ol start={startLineNo} className={outerClassName}
            onClick={this.toggleContext}>
          {defined(data.errors) &&
          <li className="expandable error"
              key="errors">{data.errors.join(", ")}</li>
          }
          {(data.context || []).map((line) => {
            var liClassName = "expandable";
            if (line[0] === data.lineNo) {
              liClassName += " active";
            }

            var lineWs;
            var lineCode;
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

          {!objectIsEmpty(data.vars) &&
            <FrameVariables data={data.vars} key="vars" />
          }
        </ol>
      );
    }

    // TODO(dcramer): implement popover annotations
    // TODO(dcramer): implement local vars
    return (
      <li className={className}>
        <p>{title} <a onClick={(e) => { e.preventDefault(); this.toggleContext(); }} className="btn btn-sm btn-default btn-toggle"><span className="icon-plus"/></a>
        </p>
        {context}
      </li>
    );
  }
});

export default Frame;
