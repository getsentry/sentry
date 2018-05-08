import PropTypes from 'prop-types';
import React from 'react';
import PlatformIcons from 'platformicons';

function getIcon(name) {
  const iconName = name.split('-')[0];
  return PlatformIcons[iconName] || PlatformIcons.generic;
}

const PlatformIcon = ({name, size, ...props}) => {
  return <img src={getIcon(name)} width={size} height={size} {...props} />;
};

PlatformIcon.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.number,
};

PlatformIcon.defaultProps = {
  size: 34,
};

export default PlatformIcon;
