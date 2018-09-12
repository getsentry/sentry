import React from 'react';
import PropTypes from 'prop-types';

function NavTabs(props) {
  let {children, underlined, ...tabProps} = props;
  let className = 'nav nav-tabs' + (underlined ? ' border-bottom' : '');
  return (
    <ul className={className} {...tabProps}>
      {children}
    </ul>
  );
}

NavTabs.propTypes = {
  underlined: PropTypes.bool,
};

export default NavTabs;
