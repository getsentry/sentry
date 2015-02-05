/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var classSet = require('react/lib/cx');

var ListLink = React.createClass({
  displayName: 'ListLink',

  propTypes: {
    activeClassName: React.PropTypes.string.isRequired,
    to: React.PropTypes.string.isRequired,
    params: React.PropTypes.object,
    query: React.PropTypes.object,
    onClick: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      activeClassName: 'active'
    };
  },

  mixins: [
    Router.Navigation,
    Router.State
  ],

  getClassName() {
    var classNames = {};

    if (this.props.className)
      classNames[this.props.className] = true;

    if (this.isActive(this.props.to, this.props.params, this.props.query))
      classNames[this.props.activeClassName] = true;

    return classSet(classNames);
  },

  render() {
    return (
      <li className={this.getClassName()}>
        <Router.Link {...this.props}>
          {this.props.children}
        </Router.Link>
      </li>
    );
  }
});

module.exports = ListLink;
