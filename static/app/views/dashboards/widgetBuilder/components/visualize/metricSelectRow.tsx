import {t} from 'sentry/locale';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType} from 'sentry/views/dashboards/types';
import {
  AggregateCompactSelect,
  GroupedSelectControl,
  PrimarySelectRow,
} from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {renderDropdownMenuFooter} from 'sentry/views/dashboards/widgetBuilder/components/visualize/selectRow';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';

export function MetricSelectRow({disabled}: {disabled: boolean}) {
  const {state, dispatch} = useWidgetBuilderContext();
  const datasetConfig = getDatasetConfig(state.dataset);
  const aggregateOptions = OPTIONS_BY_TYPE[state.traceMetric?.type ?? ''] ?? [];
  return (
    <PrimarySelectRow hasColumnParameter={false} isTraceMetrics>
      <GroupedSelectControl fullWidth>
        <MetricSelector
          traceMetric={state.traceMetric ?? {name: '', type: ''}}
          onChange={option => {
            dispatch({
              type: BuilderStateAction.SET_TRACE_METRIC,
              payload: {
                name: option.name,
                type: option.type,
              },
            });
          }}
        />
      </GroupedSelectControl>
      <GroupedSelectControl fullWidth={false}>
        <AggregateCompactSelect
          searchable
          hasColumnParameter={false}
          disabled={disabled || aggregateOptions.length <= 1}
          options={aggregateOptions}
          value={
            state.yAxis?.[0]?.kind === 'function'
              ? (state.yAxis?.[0]?.function?.[0] ?? '')
              : ''
          }
          position="bottom-start"
          menuFooter={
            state.displayType === DisplayType.TABLE ? renderDropdownMenuFooter : undefined
          }
          onChange={() => {}}
          triggerProps={{
            'aria-label': t('Aggregate Selection'),
          }}
        />
      </GroupedSelectControl>
    </PrimarySelectRow>
  );
}
