import PropTypes from 'prop-types';
import React from 'react';
import omit from 'lodash/omit';
import {Link} from 'react-router';
import classNames from 'classnames';
import {LocationDescriptor} from 'history';

type DefaultProps = {
  index: boolean;
  activeClassName: string;
};

type Props = DefaultProps & {
  to: LocationDescriptor;
  className?: string;
  query?: string;
  onClick?: () => void;
  // If supplied by parent component, decides whether link element
  // is "active" or not ... overriding default behavior of strict
  // route matching
  isActive?: (location: LocationDescriptor, indexOnly?: boolean) => boolean;
};

class ListLink extends React.Component<Props> {
  static displayName = 'ListLink';

  static contextTypes = {
    router: PropTypes.object.isRequired,
  };

  static defaultProps: DefaultProps = {
    activeClassName: 'active',
    index: false,
  };

  isActive = () => {
    const {isActive, to, query, index} = this.props;

    return (isActive || this.context.router.isActive)({pathname: to, query}, index);
  };

  getClassName = () => {
    const _classNames = {};
    const {className, activeClassName} = this.props;

    if (className) {
      _classNames[className] = true;
    }

    if (this.isActive()) {
      _classNames[activeClassName] = true;
    }

    return classNames(_classNames);
  };

  render() {
    const {index, children} = this.props;
    const carriedProps = omit(this.props, 'activeClassName', 'isActive', 'index');

    return (
      <li className={this.getClassName()}>
        <Link {...carriedProps} onlyActiveOnIndex={index}>
          {children}
        </Link>
      </li>
    );
  }
}

export default ListLink;
