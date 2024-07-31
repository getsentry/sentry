import {useCallback, useMemo} from 'react';

import {parseFormula} from 'sentry/components/metrics/equationInput/syntax/parser';
import {
  type TokenList,
  TokenType,
} from 'sentry/components/metrics/equationInput/syntax/types';
import {getQuerySymbol} from 'sentry/components/metrics/querySymbol';
import {unescapeMetricsFormula} from 'sentry/utils/metrics';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {
  isMetricsEquationWidget,
  isMetricsQueryWidget,
  type MetricsQueryWidget,
} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useMetricsContext} from 'sentry/views/metrics/context';

interface FormulaDependencies {
  dependencies: MetricsQueryWidget[];
  isError: boolean;
}

export function useFormulaDependencies() {
  const organization = useOrganization();
  const {widgets} = useMetricsContext();

  const metricsNewInputs = hasMetricsNewInputs(organization);

  const queriesLookup = useMemo(() => {
    const lookup = new Map<string, MetricsQueryWidget>();
    widgets.forEach(widget => {
      if (isMetricsQueryWidget(widget)) {
        lookup.set(getQuerySymbol(widget.id, metricsNewInputs), widget);
      }
    });
    return lookup;
  }, [widgets, metricsNewInputs]);

  const getFormulaQueryDependencies = useCallback(
    (formula: string): FormulaDependencies => {
      let tokens: TokenList = [];

      try {
        const form = metricsNewInputs ? formula.toUpperCase() : formula;
        tokens = parseFormula(unescapeMetricsFormula(form));
      } catch {
        // We should not end up here, but if we do, we should not crash the UI
        return {dependencies: [], isError: true};
      }

      const dependencies: MetricsQueryWidget[] = [];
      let isError = false;

      tokens.forEach(token => {
        if (token.type === TokenType.VARIABLE) {
          const widget = queriesLookup.get(
            metricsNewInputs ? token.content.toUpperCase() : token.content
          );
          if (widget) {
            dependencies.push(widget);
          } else {
            isError = true;
          }
        }
      });

      return {dependencies, isError};
    },
    [queriesLookup, metricsNewInputs]
  );

  const formulaDependencies = useMemo(() => {
    return widgets.reduce((acc: Record<number, FormulaDependencies>, widget) => {
      if (isMetricsEquationWidget(widget)) {
        acc[widget.id] = getFormulaQueryDependencies(widget.formula);
      }
      return acc;
    }, {});
  }, [getFormulaQueryDependencies, widgets]);

  return formulaDependencies;
}
