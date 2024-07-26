import {forwardRef} from 'react';

import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';

import {DeprecatedSymbol, Symbol} from './querySymbol';

interface EquationSymbolProps extends React.ComponentProps<typeof DeprecatedSymbol> {
  equationId: number;
}

export function getEquationSymbol(
  equationId: number,
  metricsNewInputs?: boolean
): string {
  if (metricsNewInputs) {
    return `Ƒ${equationId + 1}`;
  }
  return `ƒ${equationId + 1}`;
}

export const EquationSymbol = forwardRef<HTMLSpanElement, EquationSymbolProps>(
  function EquationSymbol({equationId, ...props}, ref) {
    const organization = useOrganization();
    if (hasMetricsNewInputs(organization)) {
      return (
        <Symbol ref={ref} {...props}>
          <span>
            Ƒ<sub>{equationId + 1}</sub>
          </span>
        </Symbol>
      );
    }
    return (
      <DeprecatedSymbol ref={ref} {...props}>
        <span>
          ƒ<sub>{equationId + 1}</sub>
        </span>
      </DeprecatedSymbol>
    );
  }
);
