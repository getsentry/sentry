import PropTypes from 'prop-types';
import React from 'react';

const InlineSvg = ({src, size, width, height, style}) => {
  const {id, viewBox} = require(`../icons/${src}.svg`).default;

  return (
    <svg
      viewBox={viewBox}
      width={width || size || '1em'}
      height={height || size || '1em'}
      style={style || ''}
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
