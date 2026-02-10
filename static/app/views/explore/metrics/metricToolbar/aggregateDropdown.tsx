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

function findGroupKey(
  metricType: string,
  aggregateValue: string | undefined
): string | number | undefined {
  const groups = GROUPED_OPTIONS_BY_TYPE[metricType];

  if (!aggregateValue || !groups) {
    return undefined;
  }

  for (const group of groups) {
    if (group.options.some(opt => String(opt.value) === aggregateValue)) {
      return group.key;
    }
  }

  return undefined;
}

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
        style={{width: '100%'}}
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
            // Find the newly selected aggregate by comparing with current selection
            const currentValues = new Set(
              visualizes.map(v => v.parsedFunction?.name ?? '')
            );
            const newlySelected = option.find(o => !currentValues.has(o.value));

            // If something new was selected, use its group; otherwise keep existing group
            const targetGroup = newlySelected
              ? findGroupKey(traceMetric.type, newlySelected.value)
              : findGroupKey(
                  traceMetric.type,
                  visualizes?.[0]?.parsedFunction?.name ?? ''
                );

            // Filter to only keep aggregates from the same group
            // This auto-deselects incompatible aggregates when switching groups
            const compatibleOptions = option.filter(
              o => findGroupKey(traceMetric.type, o.value) === targetGroup
            );

            setMetricVisualizes(
              compatibleOptions.map(o =>
                updateVisualizeYAxis(visualize, o.value, traceMetric)
              )
            );
          }
        }}
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
