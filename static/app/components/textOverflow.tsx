import * as React from 'react';
import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import overflowEllipsisLeft from 'app/styles/overflowEllipsisLeft';

type Props = {
  children: React.ReactNode;
  isParagraph?: boolean;
  ellipsisDirection?: 'left' | 'right';
  ['data-test-id']?: string;
  className?: string;
};

const TextOverflow = styled(
  ({isParagraph, className, children, ['data-test-id']: dataTestId}: Props) => {
    const Component = isParagraph ? 'p' : 'div';
    return (
      <Component className={className} data-test-id={dataTestId}>
        {children}
      </Component>
    );
  }
)`
  ${p => (p.ellipsisDirection === 'right' ? overflowEllipsis : overflowEllipsisLeft)};
  width: auto;
  line-height: 1.2;
`;

TextOverflow.defaultProps = {
  ellipsisDirection: 'right',
  isParagraph: false,
};

export default TextOverflow;
