/*** @jsx React.DOM */
var React = require('react');
var joinClasses = require('react-bootstrap/utils/joinClasses');
var classSet = require('react-bootstrap/utils/classSet');

var MenuItem = React.createClass({
  propTypes: {
    header:    React.PropTypes.bool,
    divider:   React.PropTypes.bool,
    href:      React.PropTypes.string,
    title:     React.PropTypes.string,
    onSelect:  React.PropTypes.func,
    eventKey:  React.PropTypes.any,
    isActive:  React.PropTypes.bool
  },

  getDefaultProps: function () {
    return {
      href: '#'
    };
  },

  handleClick: function (e) {
    if (this.props.onSelect) {
      e.preventDefault();
      this.props.onSelect(this.props.eventKey);
    }
  },

  renderAnchor: function () {
    return (
      <a onClick={this.handleClick} href={this.props.href} title={this.props.title} tabIndex="-1">
        {this.props.children}
      </a>
    );
  },

  render: function () {
    var classes = {
      'dropdown-header': this.props.header,
      'divider': this.props.divider,
      'active': this.props.isActive
    };

    var children = null;
    if (this.props.header) {
      children = this.props.children;
    } else if (!this.props.divider) {
      children = this.renderAnchor();
    }

    return (
      <li {...this.props} role="presentation" title={null} href={null}
        className={joinClasses(this.props.className, classSet(classes))}>
        {children}
      </li>
    );
  }
});

module.exports = MenuItem;
