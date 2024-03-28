import {MetricQueryType, type MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import type {MetricsQueryApiQueryParams} from 'sentry/utils/metrics/useMetricsQuery';
import {getEquationSymbol} from 'sentry/views/metrics/equationSymbol copy';
import {getQuerySymbol} from 'sentry/views/metrics/querySymbol';

export function widgetToQuery(
  widget: MetricWidgetQueryParams,
  isQueryOnly = false
): MetricsQueryApiQueryParams {
  return widget.type === MetricQueryType.FORMULA
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
