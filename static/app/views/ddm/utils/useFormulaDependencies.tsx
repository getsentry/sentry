import {useCallback, useMemo} from 'react';

import {unescapeMetricsFormula} from 'sentry/utils/metrics';
import {MetricQueryType, type MetricQueryWidgetParams} from 'sentry/utils/metrics/types';
import {useDDMContext} from 'sentry/views/ddm/context';
import {parseFormula} from 'sentry/views/ddm/formulaParser/parser';
import {type TokenList, TokenType} from 'sentry/views/ddm/formulaParser/types';
import {getQuerySymbol} from 'sentry/views/ddm/querySymbol';

interface FormulaDependencies {
  dependencies: MetricQueryWidgetParams[];
  isError: boolean;
}

export function useFormulaDependencies() {
  const {widgets} = useDDMContext();
  const queriesLookup = useMemo(() => {
    const lookup = new Map<string, MetricQueryWidgetParams>();
    widgets.forEach(widget => {
      if (widget.type === MetricQueryType.QUERY) {
        lookup.set(getQuerySymbol(widget.id), widget);
      }
    });
    return lookup;
  }, [widgets]);

  const getFormulaQueryDependencies = useCallback(
    (formula: string): FormulaDependencies => {
      let tokens: TokenList = [];

      try {
        tokens = parseFormula(unescapeMetricsFormula(formula));
      } catch {
        // We should not end up here, but if we do, we should not crash the UI
        return {dependencies: [], isError: true};
      }

      const dependencies: MetricQueryWidgetParams[] = [];
      let isError = false;

      tokens.forEach(token => {
        if (token.type === TokenType.VARIABLE) {
          const widget = queriesLookup.get(token.content);
          if (widget) {
            dependencies.push(widget);
          } else {
            isError = true;
          }
        }
      });

      return {dependencies, isError};
    },
    [queriesLookup]
  );

  const formulaDependencies = useMemo(() => {
    return widgets.reduce((acc: Record<number, FormulaDependencies>, widget) => {
      if (widget.type === MetricQueryType.FORMULA) {
        acc[widget.id] = getFormulaQueryDependencies(widget.formula);
      }
      return acc;
    }, {});
  }, [getFormulaQueryDependencies, widgets]);

  return formulaDependencies;
}
