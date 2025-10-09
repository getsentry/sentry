import {CompactSelect} from 'sentry/components/core/compactSelect';
import type {SelectOption} from 'sentry/components/core/compactSelect/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {
  useQueryParamsGroupBys,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface GroupBySelectorProps {
  /**
   * The metric name to filter attributes by
   */
  metricName: string;
}

/**
 * A selector component for choosing metric group by attributes.
 * Fetches available attribute keys from the trace-items API endpoint
 * and displays them as options in a compact select dropdown.
 */
export function GroupBySelector({metricName}: GroupBySelectorProps) {
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();

  const metricNameFilter = metricName ? `metric.name:"${metricName}"` : undefined;

  const {attributes: numberTags, isLoading: numberTagsLoading} =
    useTraceItemAttributeKeys({
      traceItemType: TraceItemDataset.TRACEMETRICS,
      type: 'number',
      enabled: Boolean(metricNameFilter),
      query: metricNameFilter,
    });
  const {attributes: stringTags, isLoading: stringTagsLoading} =
    useTraceItemAttributeKeys({
      traceItemType: TraceItemDataset.TRACEMETRICS,
      type: 'string',
      enabled: Boolean(metricNameFilter),
      query: metricNameFilter,
    });

  const enabledOptions: Array<SelectOption<string>> = useGroupByFields({
    groupBys: [],
    numberTags: numberTags ?? {},
    stringTags: stringTags ?? {},
    traceItemType: TraceItemDataset.TRACEMETRICS,
    hideEmptyOption: true,
  });

  const isLoading = numberTagsLoading || stringTagsLoading;
  const triggerLabel = isLoading ? <LoadingIndicator size={16} /> : undefined;

  return (
    <CompactSelect<string>
      multiple
      options={enabledOptions}
      value={[...groupBys]}
      disabled={isLoading || enabledOptions.length === 0}
      triggerProps={triggerLabel ? {children: triggerLabel} : undefined}
      onChange={selectedOptions => {
        setGroupBys(selectedOptions.map(option => option.value));
      }}
    />
  );
}
