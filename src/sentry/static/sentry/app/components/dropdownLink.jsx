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
    disabled:  React.PropTypes.bool,
    onOpen:    React.PropTypes.func,
    onClose:   React.PropTypes.func,
    openOnHover: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      disabled: false,
      caret: true,
      openOnHover: false
    };
  },

  componentDidMount() {
    var $container = $(this.refs.container.getDOMNode());
    var $toggle = $(this.refs.toggle.getDOMNode());
    if (this.props.onOpen) {
      $container.on('shown.bs.dropdown', this.props.onOpen);
    }
    if (this.props.onClose) {
      $container.on('hidden.bs.dropdown', this.props.onClose);
    }
    $toggle.dropdown();
    if (this.props.openOnHover) {
      $container.hover(() => {
        $toggle.dropdown('toggle');
      }, () => {
        $toggle.dropdown('toggle');
      });
    }
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
      <span className={joinClasses(this.props.topLevelClasses, topLevelClasses)}
            ref="container">
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
