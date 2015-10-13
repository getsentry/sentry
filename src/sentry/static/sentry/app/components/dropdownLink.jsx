import classNames from "classnames";
import React from "react";

require("bootstrap/js/dropdown");

var DropdownLink = React.createClass({
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
    return React.findDOMNode(this).classList.contains("open");
  },

  close() {
    React.findDOMNode(this).classList.remove("open");
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
    var className = classNames({
      "dropdown-toggle": true,
      "disabled": this.props.disabled,
    });

    var topLevelClasses = classNames({
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
