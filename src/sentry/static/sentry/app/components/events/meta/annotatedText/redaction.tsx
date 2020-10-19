import React from 'react';
import styled from '@emotion/styled';

type Props = {
  children: React.ReactNode;
  withoutBackground?: boolean;
  className?: string;
};

const Redaction = styled(({children, className}: Props) => (
  <span className={className}>{children}</span>
))`
  cursor: default;
  vertical-align: middle;
  ${p => !p.withoutBackground && `background: rgba(255, 0, 0, 0.05);`}
`;
export default Redaction;
