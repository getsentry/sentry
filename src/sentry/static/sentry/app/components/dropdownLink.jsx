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
  },

  getDefaultProps() {
    return {
      disabled: false,
      caret: true,
    };
  },

  isOpen() {
    return this.getDOMNode().classList.contains("open");
  },

  onToggle(e) {
    if (this.isOpen()) {
      this.props.onOpen();
    } else {
      this.props.onClose();
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
      <span className={joinClasses(this.props.topLevelClasses, topLevelClasses)}>
        <a className={joinClasses(this.props.className, className)} data-toggle="dropdown" onClick={this.onToggle}>
          {this.props.title}
          {this.props.caret &&
            <i className="icon-arrow-down" />
          }
        </a>
        <ul className={joinClasses(this.props.menuClasses, "dropdown-menu")}>
          {this.props.children}
        </ul>
      </span>
    );
  }
});

module.exports = DropdownLink;
