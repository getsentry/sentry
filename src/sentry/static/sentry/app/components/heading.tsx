import React from 'react';
import PropTypes from 'prop-types';
import {css} from '@emotion/core';

const resetHeadingStyle = css`
  margin-bottom: 0 !important;
`;

type HeadingComponent = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

type Props = {
  is: HeadingComponent;
  children: React.ReactNode;
  className?: string;
};

const Heading = React.forwardRef<HTMLHeadingElement, Props>(function Heading(
  {className, is, ...props},
  ref
) {
  const Component = is;

  return <Component className={className} css={resetHeadingStyle} ref={ref} {...props} />;
});

Heading.propTypes = {
  // @ts-ignore type 'string' is not assignable to type 'HeadingComponent'.
  is: PropTypes.oneOf(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).isRequired,
};

export {Heading};
