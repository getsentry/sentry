import {useMemo} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import type {SelectOption} from 'sentry/components/core/compactSelect/types';
import {t} from 'sentry/locale';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {HiddenTraceMetricGroupByFields} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsGroupBys,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface GroupBySelectorProps {
  /**
   * The metric to filter attributes by
   */
  traceMetric: TraceMetric;
}

/**
 * A selector component for choosing metric group by attributes.
 * Fetches available attribute keys from the trace-items API endpoint
 * and displays them as options in a compact select dropdown.
 */
export function GroupBySelector({traceMetric}: GroupBySelectorProps) {
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();

  const traceMetricFilter = createTraceMetricFilter(traceMetric);

  const {attributes: numberTags, isLoading: numberTagsLoading} =
    useTraceItemAttributeKeys({
      traceItemType: TraceItemDataset.TRACEMETRICS,
      type: 'number',
      enabled: Boolean(traceMetricFilter),
      query: traceMetricFilter,
    });
  const {attributes: stringTags, isLoading: stringTagsLoading} =
    useTraceItemAttributeKeys({
      traceItemType: TraceItemDataset.TRACEMETRICS,
      type: 'string',
      enabled: Boolean(traceMetricFilter),
      query: traceMetricFilter,
    });

  const visibleNumberTags = useMemo(() => {
    return Object.fromEntries(
      Object.entries(numberTags ?? {}).filter(
        ([key]) => !HiddenTraceMetricGroupByFields.includes(key)
      )
    );
  }, [numberTags]);

  const visibleStringTags = useMemo(() => {
    return Object.fromEntries(
      Object.entries(stringTags ?? {}).filter(
        ([key]) => !HiddenTraceMetricGroupByFields.includes(key)
      )
    );
  }, [stringTags]);

  const enabledOptions: Array<SelectOption<string>> = useGroupByFields({
    groupBys,
    numberTags: visibleNumberTags ?? {},
    stringTags: visibleStringTags ?? {},
    traceItemType: TraceItemDataset.TRACEMETRICS,
    hideEmptyOption: true,
  });

  const isLoading = numberTagsLoading || stringTagsLoading;

  return (
    <CompactSelect
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
