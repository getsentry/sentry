import React from "react";
import Router from "react-router";
import classNames from 'classnames';

var ListLink = React.createClass({
  displayName: 'ListLink',

  propTypes: {
    activeClassName: React.PropTypes.string.isRequired,
    to: React.PropTypes.string.isRequired,
    params: React.PropTypes.object,
    query: React.PropTypes.object,
    onClick: React.PropTypes.func,

    // If supplied by parent component, decides whether link element
    // is "active" or not ... overriding default behavior of strict
    // route matching
    isActive: React.PropTypes.func
  },

  contextTypes: {
    router: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      activeClassName: 'active'
    };
  },

  isActive() {
    return (this.props.isActive || this.context.router.isActive)
      .call(this, this.props.to, this.props.params, this.props.query);
  },

  getClassName() {
    var _classNames = {};

    if (this.props.className)
      _classNames[this.props.className] = true;

    if (this.isActive(this.props.to, this.props.params, this.props.query))
      _classNames[this.props.activeClassName] = true;

    return classNames(_classNames);
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

export default ListLink;

