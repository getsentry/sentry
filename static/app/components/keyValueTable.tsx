import {Fragment} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = {
  keyName: React.ReactNode;
  value: React.ReactNode;
  type?: undefined | 'error' | 'warning';
};

export const KeyValueTable = styled('dl')<{noMargin?: boolean}>`
  display: grid;
  grid-template-columns: 50% 50%;
  ${p => (p.noMargin ? 'margin-bottom: 0;' : null)}
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
  font-size: ${theme.fontSize.md};
  padding: ${space(0.5)} ${space(1)};
  font-weight: ${theme.fontWeight.normal};
  line-height: inherit;
  ${theme.overflowEllipsis};

  background-color: ${type === 'error'
    ? theme.colors.red100 + ' !important'
    : type === 'warning'
      ? 'var(--background-warning-default, rgba(245, 176, 0, 0.09)) !important'
      : 'inherit'};
  &:nth-of-type(2n-1) {
    background-color: ${theme.tokens.background.secondary};
  }
`;

const Key = styled('dt')<{type: Props['type']}>`
  ${commonStyles};
  display: flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.primary};
`;

const Value = styled('dd')<{type: Props['type']}>`
  ${commonStyles};
  color: ${p => p.theme.tokens.content.secondary};
  text-align: right;
`;
