import {getEquationSymbol} from 'sentry/components/metrics/equationSymbol';
import {getQuerySymbol} from 'sentry/components/metrics/querySymbol';
import {isMetricsEquationWidget, type MetricsWidget} from 'sentry/utils/metrics/types';
import type {MetricsQueryApiQueryParams} from 'sentry/utils/metrics/useMetricsQuery';

export function widgetToQuery({
  widget,
  isQueryOnly = false,
  metricsNewInputs = false,
}: {
  metricsNewInputs: boolean;
  widget: MetricsWidget;
  isQueryOnly?: boolean;
}): MetricsQueryApiQueryParams {
  return isMetricsEquationWidget(widget)
    ? {
        name: getEquationSymbol(widget.id, metricsNewInputs),
        formula: widget.formula,
      }
    : {
        name: getQuerySymbol(widget.id, metricsNewInputs),
        mri: widget.mri,
        aggregation: widget.aggregation,
        condition: widget.condition,
        groupBy: widget.groupBy,
        query: widget.query,
        isQueryOnly: isQueryOnly || widget.isHidden,
      };
}
