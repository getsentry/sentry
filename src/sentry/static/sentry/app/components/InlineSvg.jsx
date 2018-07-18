import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

const InlineSvg = ({src, size, width, height, ...props}) => {
  const {id, viewBox} = require(`../icons/${src}.svg`).default;

  return (
    <StyledSvg
      {...props}
      viewBox={viewBox}
      width={width || size || '1em'}
      height={height || size || '1em'}
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
};

const StyledSvg = styled('svg')`
  vertical-align: middle;
`;

export default InlineSvg;
