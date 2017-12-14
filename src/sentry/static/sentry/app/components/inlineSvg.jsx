import PropTypes from 'prop-types';
import React from 'react';

const InlineSvg = ({src, size, width, height}) => {
  const {id, viewBox} = require(`../icons/${src}`).default;

  return (
    <svg
      viewBox={viewBox}
      width={width || size || '1em'}
      height={height || size || '1em'}
    >
      <use href={`#${id}`} xlinkHref={`#${id}`} />
    </svg>
  );
};

InlineSvg.propTypes = {
  src: PropTypes.string.isRequired,
  size: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
};

export default InlineSvg;
