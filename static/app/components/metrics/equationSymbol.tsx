import {forwardRef} from 'react';

import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';

import {DeprecatedSymbol, Symbol} from './querySymbol';

interface EquationSymbolProps extends React.ComponentProps<typeof DeprecatedSymbol> {
  equationId: number;
}

export function getEquationSymbol(equationId: number) {
  return `ƒ${equationId + 1}`;
}

export const EquationSymbol = forwardRef<HTMLSpanElement, EquationSymbolProps>(
  function EquationSymbol({equationId, ...props}, ref) {
    const organization = useOrganization();
    const Component = hasMetricsNewInputs(organization) ? Symbol : DeprecatedSymbol;
    return (
      <Component ref={ref} {...props}>
        <span>
          ƒ<sub>{equationId + 1}</sub>
        </span>
      </Component>
    );
  }
);
