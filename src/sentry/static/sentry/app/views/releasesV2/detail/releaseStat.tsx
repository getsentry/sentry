import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  label: string;
  children: React.ReactNode;
};

const ReleaseStat = ({label, children}: Props) => (
  <Wrapper>
    <Label>{label}</Label>
    <Value>{children}</Value>
  </Wrapper>
);

const Wrapper = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin: ${space(2)} ${space(4)} ${space(2)} 0;
  }
`;

const Label = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  color: ${p => p.theme.gray500};
  line-height: 1.3;
  margin-bottom: ${space(0.25)};
  white-space: nowrap;
`;
const Value = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray700};
`;

export default ReleaseStat;
