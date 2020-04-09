import React from 'react';
import styled from '@emotion/styled';

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
    margin: 10px 30px 10px 0;
  }
`;

const Label = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  color: ${p => p.theme.gray2};
  line-height: 1.3;
`;
const Value = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray4};
`;

export default ReleaseStat;
