import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = {
  kkey: string;
  value: string;
};

export function Filter({kkey, value}: Props) {
  return (
    <FilterWrapper>
      <Key>{kkey}</Key>
      <Operator>:</Operator>
      <Value>{value}</Value>
    </FilterWrapper>
  );
}

const FilterWrapper = styled('span')`
  --token-bg: ${p => p.theme.searchTokenBackground.valid};
  --token-border: ${p => p.theme.searchTokenBorder.valid};
  --token-value-color: ${p => p.theme.blue400};

  position: relative;
`;

const filterCss = css`
  background: var(--token-bg);
  border: 0.5px solid var(--token-border);
  padding: ${space(0.25)} 0;
`;

const Key = styled('span')`
  ${filterCss};
  border-right: none;
  font-weight: bold;
  border-radius: 2px 0 0 2px;
  padding-left: 1px;
  margin-left: -2px;
`;

const Operator = styled('span')`
  ${filterCss};
  border-left: none;
  border-right: none;
  margin: -1px 0;
  color: ${p => p.theme.pink400};
`;

const Value = styled('span')`
  ${filterCss};
  border-left: none;
  border-radius: 0 2px 2px 0;
  color: var(--token-value-color);
  margin: -1px -2px -1px 0;
  padding-right: 1px;
`;
