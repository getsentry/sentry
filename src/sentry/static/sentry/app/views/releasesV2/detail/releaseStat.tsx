import React from 'react';
import styled from '@emotion/styled';

type Props = {
  label: string;
  children: React.ReactNode;
};

const ReleaseStat = ({label, children}: Props) => (
  <div>
    <Label>{label}</Label>
    <Value>{children}</Value>
  </div>
);

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
