import {forwardRef} from 'react';

import {Symbol} from './querySymbol';

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
