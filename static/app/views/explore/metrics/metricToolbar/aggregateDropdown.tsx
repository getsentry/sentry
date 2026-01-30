import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DEFAULT_YAXIS_BY_TYPE,
  GROUPED_OPTIONS_BY_TYPE,
  OPTIONS_BY_TYPE,
} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricVisualize,
  useMetricVisualizes,
  useSetMetricVisualize,
  useSetMetricVisualizes,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {updateVisualizeYAxis} from 'sentry/views/explore/metrics/utils';

export function AggregateDropdown({traceMetric}: {traceMetric: TraceMetric}) {
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();

  const visualizes = useMetricVisualizes();
  const setMetricVisualizes = useSetMetricVisualizes();
  const hasMultiSelect = useOrganization().features.includes(
    'tracemetrics-overlay-charts-ui'
  );

  if (hasMultiSelect) {
    return (
      <CompactSelect
        multiple
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            prefix={t('Agg')}
            style={{width: '100%'}}
          />
        )}
        options={GROUPED_OPTIONS_BY_TYPE[traceMetric.type] ?? []}
        value={visualizes.map(v => v.parsedFunction?.name ?? '')}
        onChange={(option: Array<SelectOption<string>>) => {
          if (option.length === 0) {
            setMetricVisualizes([
              updateVisualizeYAxis(
                visualize,
                DEFAULT_YAXIS_BY_TYPE[traceMetric.type]!,
                traceMetric
              ),
            ]);
          } else {
            setMetricVisualizes(
              option.map(o => updateVisualizeYAxis(visualize, o.value, traceMetric))
            );
          }
        }}
        style={{width: '100%'}}
      />
    );
  }

  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          prefix={t('Agg')}
          style={{width: '100%'}}
        />
      )}
      options={OPTIONS_BY_TYPE[traceMetric.type] ?? []}
      value={visualize.parsedFunction?.name ?? ''}
      onChange={option => {
        setVisualize(updateVisualizeYAxis(visualize, option.value, traceMetric));
      }}
      style={{width: '100%'}}
    />
  );
}
