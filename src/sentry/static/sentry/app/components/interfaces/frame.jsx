import React from "react";
import classNames from "classnames";
import {defined, objectIsEmpty} from "../../utils";
import PropTypes from "../../proptypes";
import ContextData from "../contextData";

var FrameVariables = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  preventToggling(event) {
    event.stopPropagation();
  },

  render() {
    var children = [];
    var data = this.props.data;

    for (var key in data) {
      var value = data[key];
      children.push(<dt key={'dt-' + key}>{key}</dt>);
      children.push((
        <dd key={'dd-' + key}>
          <ContextData data={value} />
        </dd>
      ));
    }

    return (
      <dl className="vars expandable" onClick={this.preventToggling}>{children}</dl>
    );
  }
});

var Frame = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

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

  toggleContext() {
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

    var outerClassName = "context";
    if (this.state.isExpanded) {
      outerClassName += " expanded";
    }

    var context = '';
    if (defined(data.context) && data.context.length) {
      var startLineNo = data.context[0][0];
      context = (
        <ol start={startLineNo} className={outerClassName}
            onClick={this.toggleContext}>
          {defined(data.errors) &&
          <li className="expandable error"
              key="errors">{data.errors.join(", ")}</li>
          }
          {data.context.map((line) => {
            var className = "expandable";
            if (line[0] === data.lineNo) {
              className += " active";
            }

            var lineWs;
            var lineCode;
            if (defined(line[1])) {
              [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m);
            } else {
              lineWs = '';
              lineCode = '';
            }
            return <li className={className} key={line[0]}><span className="ws">{
              lineWs}</span><span className="contextline">{lineCode
            }</span> <span className="icon-plus"></span></li>;
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
        <p>{title}</p>
        {context}
      </li>
    );
  }
});

export default Frame;
