import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

function NavTabs(props) {
  let {underlined, ...tabProps} = props;
  let className = classnames('nav nav-tabs', {'border-bottom': underlined});
  return <ul className={className} {...tabProps} />;
}

NavTabs.propTypes = {
  underlined: PropTypes.bool,
};

export default NavTabs;
