import {Fragment} from 'react';
import {Theme} from '@emotion/react';
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

const commonStyles = ({theme, type}: {type: Props['type']} & {theme: Theme}) => `
  font-size: ${theme.fontSizeMedium};
  padding: ${space(0.5)} ${space(1)};
  font-weight: normal;
  line-height: inherit;
  ${p => p.theme.overflowEllipsis};

  background-color: ${
    type === 'error'
      ? theme.red100 + ' !important'
      : type === 'warning'
      ? 'var(--background-warning-default, rgba(245, 176, 0, 0.09)) !important'
      : 'inherit'
  };
  &:nth-of-type(2n-1) {
    background-color: ${theme.backgroundSecondary};
  }
`;

const Key = styled('dt')<{type: Props['type']}>`
  ${commonStyles};
  color: ${p => p.theme.textColor};
`;

const Value = styled('dd')<{type: Props['type']}>`
  ${commonStyles};
  color: ${p => p.theme.subText};
  text-align: right;
`;
