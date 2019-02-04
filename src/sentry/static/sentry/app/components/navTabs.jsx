import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

function NavTabs(props) {
  const {underlined, className, ...tabProps} = props;
  const mergedClassName = classnames('nav nav-tabs', className, {
    'border-bottom': underlined,
  });
  return <ul className={mergedClassName} {...tabProps} />;
}

NavTabs.propTypes = {
  underlined: PropTypes.bool,
};

export default NavTabs;
