import React from 'react';
import styled from '@emotion/styled';

import overflowEllipsisLeft from 'app/styles/overflowEllipsisLeft';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {
  children: React.ReactNode;
  isParagraph?: boolean;
  ellipsisDirection?: 'left' | 'right';
  className?: string;
};

const TextOverflow = styled(({isParagraph, className, children}: Props) => {
  const Component = isParagraph ? 'p' : 'div';
  return <Component className={className}>{children}</Component>;
})`
  ${p => (p.ellipsisDirection === 'right' ? overflowEllipsis : overflowEllipsisLeft)};
  width: auto;
`;

TextOverflow.defaultProps = {
  ellipsisDirection: 'right',
  isParagraph: false,
};

export default TextOverflow;
