import React from 'react';
import _ from 'underscore';
import {Link} from 'react-router';
import classNames from 'classnames';

const ListLink = React.createClass({
  displayName: 'ListLink',

  propTypes: {
    activeClassName: React.PropTypes.string.isRequired,
    to: React.PropTypes.string.isRequired,
    query: React.PropTypes.object,
    onClick: React.PropTypes.func,
    index: React.PropTypes.bool,

    // If supplied by parent component, decides whether link element
    // is "active" or not ... overriding default behavior of strict
    // route matching
    isActive: React.PropTypes.func
  },

  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  getDefaultProps() {
    return {
      activeClassName: 'active',
      index: false,
    };
  },

  isActive() {
    return (this.props.isActive || this.context.router.isActive)(
      {pathname: this.props.to, query: this.props.query}, this.props.index
    );
  },

  getClassName() {
    let _classNames = {};

    if (this.props.className)
      _classNames[this.props.className] = true;

    if (this.isActive())
      _classNames[this.props.activeClassName] = true;

    return classNames(_classNames);
  },

  render() {
    let carriedProps = _.omit(this.props, 'activeClassName', 'isActive', 'index');
    return (
      <li className={this.getClassName()}>
        <Link {...carriedProps} onlyActiveOnIndex={this.props.index}>{this.props.children}</Link>
      </li>
    );
  }
});

export default ListLink;

