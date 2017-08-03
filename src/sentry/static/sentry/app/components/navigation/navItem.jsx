/* eslint-disable react/jsx-key */
import React from 'react';
import {Link} from 'react-router';

const NavItem = React.createClass({
  render() {
    // let classNames;

    return (
      <Link className="nav-item" {...this.props}>
        {this.props.children}
      </Link>
    );
  }
});

export default NavItem;
