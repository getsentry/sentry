import React from 'react';
import styled from '@emotion/styled';

type Props = {
  children: React.ReactNode;
};

const Redaction = ({children}: Props) => <Wrapper>{children}</Wrapper>;
export default Redaction;

const Wrapper = styled('span')`
  background: rgba(255, 0, 0, 0.05);
  cursor: default;
`;
