import {CompactSelect} from 'sentry/components/core/compactSelect';
import type {SelectOption} from 'sentry/components/core/compactSelect/types';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
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

  const metricNameFilter = metricName
    ? MutableSearch.fromQueryObject({['metric.name']: [metricName]}).formatString()
    : undefined;

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

  return (
    <CompactSelect<string>
      multiple
      searchable
      triggerProps={{
        prefix: t('Group by'),
      }}
      options={enabledOptions}
      value={[...groupBys]}
      loading={isLoading}
      disabled={enabledOptions.length === 0}
      onChange={selectedOptions => {
        setGroupBys(selectedOptions.map(option => option.value));
      }}
    />
  );
}
