import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const Symbol = styled('span')<{isHidden?: boolean; isSelected?: boolean}>`
  display: flex;
  width: 16px;
  height: 16px;
  line-height: 16px;
  padding: ${space(0.5)};
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  border-radius: ${p => p.theme.borderRadius};
  font-weight: 500;
  color: ${p => p.theme.black};
  font-size: 11px;
  background: ${p => p.theme.yellow300};
  margin-top: -2px;

  ${p =>
    p.isSelected &&
    !p.isHidden &&
    `
  background: ${p.theme.purple300};
  color: ${p.theme.white};
  `}

  ${p =>
    p.isHidden &&
    `
  background: ${p.theme.gray300};
  color: ${p.theme.white};
  `}
`;

interface EquationSymbolProps extends React.ComponentProps<typeof Symbol> {
  equationId: number;
}

export function getEquationSymbol(equationId: number) {
  return `ƒ${equationId + 1}`;
}

export const EquationSymbol = forwardRef<HTMLSpanElement, EquationSymbolProps>(
  function EquationSymbol({equationId, ...props}, ref) {
    return (
      <Symbol ref={ref} {...props}>
        <span>
          ƒ<sub>{equationId + 1}</sub>
        </span>
      </Symbol>
    );
  }
);
