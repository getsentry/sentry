import * as React from 'react';
import styled from 'react-emotion';

const InlineSvg = ({src, size, width, height, ...props}: PropTypes) => {
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

type PropTypes = {
  src: string;
  size?: string;
  width?: string;
  height?: string;
};

const StyledSvg = styled('svg')`
  vertical-align: middle;
`;

export default InlineSvg;
