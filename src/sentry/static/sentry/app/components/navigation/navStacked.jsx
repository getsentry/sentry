import React from 'react';
import 'style-loader!./navigation.less';

const NavStacked = function(props) {
  return <div className="nav-stacked">{props.children}</div>;
};

export default NavStacked;
