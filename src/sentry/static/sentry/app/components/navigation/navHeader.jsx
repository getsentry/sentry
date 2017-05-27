import React from 'react';

const NavHeader = React.createClass({
  render() {
    return (
      <div className="nav-header">
        {this.props.children}
      </div>
    );
  }
});

export default NavHeader;
