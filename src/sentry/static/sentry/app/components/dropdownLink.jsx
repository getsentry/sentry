/*** @jsx React.DOM */
var joinClasses = require("react/lib/joinClasses");

var classSet = require("react/lib/cx");
var React = require("react");

var $ = require("jquery");
require("bootstrap/js/dropdown");

var DropdownLink = React.createClass({
  propTypes: {
    title:     React.PropTypes.node,
    caret:     React.PropTypes.bool,
    disabled:  React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      disabled: false,
      caret: true
    };
  },

  componentDidMount() {
    // These can be configured via options; this is just a demo
    $(this.getDOMNode()).find('.dropdown-toggle').dropdown();
  },

  render() {
    var className = classSet({
      "dropdown-toggle": true,
      "disabled": this.props.disabled,
    });

    var topLevelClasses = classSet({
      "dropdown" : true,
      "btn-group": this.props.btnGroup,
    });

    return (
      <span className={joinClasses(this.props.topLevelClasses, topLevelClasses)}>
        <a className={joinClasses(this.props.className, className)} ref="toggle"
           data-toggle="dropdown">
          {this.props.title}
          {this.props.caret &&
            <i className="icon-arrow-down" />
          }
        </a>
        <ul className={joinClasses(this.props.menuClasses, "dropdown-menu")} ref="menu">
          {this.props.children}
        </ul>
      </span>
    );
  }
});

module.exports = DropdownLink;
