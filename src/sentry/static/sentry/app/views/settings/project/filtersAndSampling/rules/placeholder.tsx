import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  top: number;
  left: number;
  height: number;
  width: number;
  className?: string;
};

const Placeholder = styled(({className}: Props) => (
  <div className={className}>
    <Content />
  </div>
))`
  position: absolute;
  height: ${p => p.height}px;
  width: ${p => p.width}px;
  top: ${p => p.top}px;
  left: ${p => p.left}px;
  padding: ${space(1)};
`;

export default Placeholder;

const Content = styled('div')`
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  height: 100%;
  width: 100%;
`;
