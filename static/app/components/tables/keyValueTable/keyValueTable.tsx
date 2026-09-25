import {Fragment} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {DescriptionList} from '@sentry/scraps/descriptionList';

type Props = {
  keyName: React.ReactNode;
  value: React.ReactNode;
  type?: undefined | 'error' | 'warning';
};

export const KeyValueTable = styled(DescriptionList)<{margin?: boolean}>`
  grid-template-columns: 50% 50%;
  gap: 0;
  align-items: stretch;
  ${p => (p.margin ? 'margin-bottom: 20px;' : null)}
`;

export function KeyValueTableRow({keyName, value, type}: Props) {
  return (
    <Fragment>
      <Key type={type}>{keyName}</Key>
      <Value type={type}>{value}</Value>
    </Fragment>
  );
}

const commonStyles = ({theme, type}: {type: Props['type']} & {theme: Theme}) => css`
  font-size: ${theme.font.size.md};
  padding: ${theme.space.xs} ${theme.space.md};
  font-weight: ${theme.font.weight.sans.regular};
  line-height: inherit;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  background-color: ${
    type === 'error'
      ? theme.colors.red100 + ' !important'
      : type === 'warning'
        ? theme.tokens.background.transparent.warning.muted + ' !important'
        : 'inherit'
  };
  &:nth-of-type(2n-1) {
    background-color: ${theme.tokens.background.secondary};
  }
`;

const Key = styled(DescriptionList.Term, {
  shouldForwardProp: prop => prop !== 'type',
})<{type: Props['type']}>`
  ${commonStyles};
  display: flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.primary};
`;

const Value = styled(DescriptionList.Details, {
  shouldForwardProp: prop => prop !== 'type',
})<{type: Props['type']}>`
  ${commonStyles};
  text-align: right;
  color: ${p => p.theme.tokens.content.secondary};
`;
