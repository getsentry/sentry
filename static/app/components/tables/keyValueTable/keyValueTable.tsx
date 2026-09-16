import {Fragment} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {presetTypography, rowTint} from './presets';

type Props = {
  keyName: React.ReactNode;
  value: React.ReactNode;
  type?: undefined | 'error' | 'warning';
};

/**
 * Rows are flat by default. `striped` is opt-in for wide tables with many rows;
 * it lives here rather than on the row because a `<dl>` interleaves `dt` and
 * `dd`, so alternating pairs need `nth-of-type` from the container.
 */
export const KeyValueTable = styled('dl')<{margin?: boolean; striped?: boolean}>`
  display: grid;
  grid-template-columns: 50% 50%;
  ${p => (p.margin ? null : 'margin-bottom: 0;')}

  ${p =>
    p.striped &&
    css`
      > dt:nth-of-type(2n-1),
      > dd:nth-of-type(2n-1) {
        background-color: ${p.theme.tokens.background.secondary};
      }
    `}
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
  ${presetTypography({theme, preset: 'sidebar'})};
  font-weight: ${theme.font.weight.sans.regular};
  line-height: inherit;
  display: block;
  width: 100%;

  ${rowTint({
    theme,
    hasErrors: type === 'error',
    isSuspect: type === 'warning',
  })};
`;

const Key = styled('dt')<{type: Props['type']}>`
  ${commonStyles};
  display: flex;
  align-items: center;
  text-align: start;
  color: ${p => p.theme.tokens.content.primary};
`;

const Value = styled('dd')<{type: Props['type']}>`
  ${commonStyles};
  color: ${p => p.theme.tokens.content.secondary};
`;
