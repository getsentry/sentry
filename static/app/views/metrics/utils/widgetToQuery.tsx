import {getEquationSymbol} from 'sentry/components/metrics/equationSymbol';
import {getQuerySymbol} from 'sentry/components/metrics/querySymbol';
import {isMetricsEquationWidget, type MetricsWidget} from 'sentry/utils/metrics/types';
import type {MetricsQueryApiQueryParams} from 'sentry/utils/metrics/useMetricsQuery';

export function widgetToQuery(
  widget: MetricsWidget,
  isQueryOnly = false
): MetricsQueryApiQueryParams {
  return isMetricsEquationWidget(widget)
    ? {
        name: getEquationSymbol(widget.id),
        formula: widget.formula,
      }
    : {
        name: getQuerySymbol(widget.id),
        mri: widget.mri,
        op: widget.op,
        groupBy: widget.groupBy,
        query: widget.query,
        isQueryOnly: isQueryOnly || widget.isHidden,
      };
}
