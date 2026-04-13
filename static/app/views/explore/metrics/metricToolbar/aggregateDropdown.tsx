import {Fragment} from 'react';

import {Badge} from '@sentry/scraps/badge';
import {
  CompositeSelect,
  type SelectOption,
  TriggerLabel,
} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {
  DEFAULT_YAXIS_BY_TYPE,
  GROUPED_OPTIONS_BY_TYPE,
} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricVisualize,
  useMetricVisualizes,
  useSetMetricVisualizes,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {updateVisualizeYAxis} from 'sentry/views/explore/metrics/utils';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

const MULTI_SELECT_GROUP_KEYS = new Set(['percentiles', 'stats']);

export function AggregateDropdown({traceMetric}: {traceMetric: TraceMetric}) {
  const visualize = useMetricVisualize();
  const visualizes = useMetricVisualizes();
  const setMetricVisualizes = useSetMetricVisualizes();

  const groups = GROUPED_OPTIONS_BY_TYPE[traceMetric.type] ?? [];
  const selectedNames = new Set(
    visualizes.map(v => (isVisualizeFunction(v) ? (v.parsedFunction?.name ?? '') : ''))
  );

  function handleChange(selectedOptions: Array<SelectOption<string>>) {
    if (!isVisualizeFunction(visualize)) {
      return;
    }
    if (selectedOptions.length === 0) {
      setMetricVisualizes([
        updateVisualizeYAxis(
          visualize,
          DEFAULT_YAXIS_BY_TYPE[traceMetric.type]!,
          traceMetric
        ),
      ]);
    } else {
      setMetricVisualizes(
        selectedOptions.map(o => updateVisualizeYAxis(visualize, o.value, traceMetric))
      );
    }
  }

  const selectedList = [...selectedNames].filter(Boolean);
  const defaultValue = DEFAULT_YAXIS_BY_TYPE[traceMetric.type];
  const isDefaultSelection =
    selectedList.length === 1 && selectedList[0] === defaultValue;

  return (
    <CompositeSelect
      disabled={groups.length === 0}
      menuHeaderTrailingItems={
        isDefaultSelection
          ? undefined
          : () => <CompositeSelect.ClearButton onClick={() => handleChange([])} />
      }
      style={{width: '100%'}}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          prefix={t('Agg')}
          style={{width: '100%'}}
        >
          {selectedList.length === 0 ? (
            <TriggerLabel>{t('None')}</TriggerLabel>
          ) : (
            <Fragment>
              <TriggerLabel>{selectedList[0]}</TriggerLabel>
              {selectedList.length > 1 && (
                <Badge
                  variant="muted"
                  style={{marginLeft: 4, flexShrink: 0, top: 'auto'}}
                >
                  {`+${selectedList.length - 1}`}
                </Badge>
              )}
            </Fragment>
          )}
        </OverlayTrigger.Button>
      )}
    >
      {groups.map(group => {
        const groupKey = String(group.key);
        const isMulti = MULTI_SELECT_GROUP_KEYS.has(groupKey);
        const activeValues = group.options
          .map(opt => String(opt.value))
          .filter(v => selectedNames.has(v));

        if (isMulti) {
          return (
            <CompositeSelect.Region
              key={groupKey}
              label={group.label}
              multiple
              options={group.options}
              value={activeValues}
              onChange={handleChange}
            />
          );
        }

        return (
          <CompositeSelect.Region
            key={groupKey}
            label={group.label}
            options={group.options}
            value={activeValues[0]}
            onChange={opt => handleChange([opt])}
          />
        );
      })}
    </CompositeSelect>
  );
}
