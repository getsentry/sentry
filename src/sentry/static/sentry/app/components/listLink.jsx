import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import {Link} from 'react-router';
import classNames from 'classnames';

class ListLink extends React.Component {
  static displayName = 'ListLink';

  static propTypes = {
    activeClassName: PropTypes.string.isRequired,
    to: PropTypes.string.isRequired,
    query: PropTypes.object,
    onClick: PropTypes.func,
    index: PropTypes.bool,

    // If supplied by parent component, decides whether link element
    // is "active" or not ... overriding default behavior of strict
    // route matching
    isActive: PropTypes.func,
  };

  static contextTypes = {
    router: PropTypes.object.isRequired,
  };

  static defaultProps = {
    activeClassName: 'active',
    index: false,
  };

  isActive = () => {
    return (this.props.isActive || this.context.router.isActive)(
      {pathname: this.props.to, query: this.props.query},
      this.props.index
    );
  };

  getClassName = () => {
    let _classNames = {};

    if (this.props.className) _classNames[this.props.className] = true;

    if (this.isActive()) _classNames[this.props.activeClassName] = true;

    return classNames(_classNames);
  };

  render() {
    let carriedProps = _.omit(this.props, 'activeClassName', 'isActive', 'index');
    return (
      <li className={this.getClassName()}>
        <Link {...carriedProps} onlyActiveOnIndex={this.props.index}>
          {this.props.children}
        </Link>
      </li>
    );
  }
}

export default ListLink;
