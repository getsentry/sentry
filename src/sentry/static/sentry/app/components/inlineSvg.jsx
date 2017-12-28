import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

const InlineSvg = ({src, size, width, height, style, className}) => {
  const {id, viewBox} = require(`../icons/${src}.svg`).default;

  return (
    <StyledSvg
      viewBox={viewBox}
      width={width || size || '1em'}
      height={height || size || '1em'}
      style={style || {}}
      className={className || ''}
    >
      <use href={`#${id}`} xlinkHref={`#${id}`} />
    </StyledSvg>
  );
};

InlineSvg.propTypes = {
  src: PropTypes.string.isRequired,
  size: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
  style: PropTypes.object,
  className: PropTypes.string,
};

const StyledSvg = styled('svg')`
  vertical-align: middle;
`;

export default InlineSvg;
