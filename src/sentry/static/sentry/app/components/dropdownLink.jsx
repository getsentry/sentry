import React from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";

require("bootstrap/js/dropdown");

const DropdownLink = React.createClass({
  propTypes: {
    title:     React.PropTypes.node,
    caret:     React.PropTypes.bool,
    disabled:  React.PropTypes.bool,
    onOpen:    React.PropTypes.func,
    onClose:   React.PropTypes.func,
  },

  getDefaultProps() {
    return {
      disabled: false,
      caret: true,
    };
  },

  isOpen() {
    return ReactDOM.findDOMNode(this).classList.contains("open");
  },

  close() {
    ReactDOM.findDOMNode(this).classList.remove("open");
  },

  onToggle(e) {
    if (this.isOpen()) {
      if (this.props.onOpen) {
        this.props.onOpen(e);
      }
    } else {
      if (this.props.onClose) {
        this.props.onClose(e);
      }
    }
  },

  render() {
    let className = classNames({
      "dropdown-toggle": true,
      "disabled": this.props.disabled,
    });

    let topLevelClasses = classNames({
      "dropdown" : true,
    });

    return (
      <span className={classNames(this.props.topLevelClasses, topLevelClasses)}>
        <a className={classNames(this.props.className, className)} data-toggle="dropdown" onClick={this.onToggle}>
          {this.props.title}
          {this.props.caret &&
            <i className="icon-arrow-down" />
          }
        </a>
        <ul className={classNames(this.props.menuClasses, "dropdown-menu")}>
          {this.props.children}
        </ul>
      </span>
    );
  }
});

export default DropdownLink;
