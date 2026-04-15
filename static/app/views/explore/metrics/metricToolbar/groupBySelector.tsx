import {useCallback, useMemo} from 'react';

import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {HiddenTraceMetricGroupByFields} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsGroupBys,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  selectTraceItemTagCollection,
  traceItemAttributeKeysOptions,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

interface GroupBySelectorProps {
  /**
   * The metric to filter attributes by
   */
  traceMetric: TraceMetric;
  /**
   * Whether to skip the trace metric filter.
   *
   * For equations, because at the moment there isn't an easy way to filter
   * the attributes to the relevant attributes.
   */
  skipTraceMetricFilter?: boolean;
}

/**
 * A selector component for choosing metric group by attributes.
 * Fetches available attribute keys from the trace-items API endpoint
 * and displays them as options in a compact select dropdown.
 */
export function GroupBySelector({
  traceMetric,
  skipTraceMetricFilter,
}: GroupBySelectorProps) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();

  const traceMetricFilter = createTraceMetricFilter(traceMetric);

  const {data: numberTags, isLoading: numberTagsLoading} = useQuery({
    ...traceItemAttributeKeysOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.TRACEMETRICS,
      type: 'number',
      query: skipTraceMetricFilter ? undefined : traceMetricFilter,
    }),
    select: selectTraceItemTagCollection('number'),
    enabled: skipTraceMetricFilter || Boolean(traceMetricFilter),
  });

  const {data: stringTags, isLoading: stringTagsLoading} = useQuery({
    ...traceItemAttributeKeysOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.TRACEMETRICS,
      type: 'string',
      query: skipTraceMetricFilter ? undefined : traceMetricFilter,
    }),
    select: selectTraceItemTagCollection('string'),
    enabled: skipTraceMetricFilter || Boolean(traceMetricFilter),
  });

  const {data: booleanTags, isLoading: booleanTagsLoading} = useQuery({
    ...traceItemAttributeKeysOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.TRACEMETRICS,
      type: 'boolean',
      query: skipTraceMetricFilter ? undefined : traceMetricFilter,
    }),
    select: selectTraceItemTagCollection('boolean'),
    enabled: skipTraceMetricFilter || Boolean(traceMetricFilter),
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

  const visibleBooleanTags = useMemo(() => {
    return Object.fromEntries(
      Object.entries(booleanTags ?? {}).filter(
        ([key]) => !HiddenTraceMetricGroupByFields.includes(key)
      )
    );
  }, [booleanTags]);

  const enabledOptions = useGroupByFields({
    groupBys,
    numberTags: visibleNumberTags ?? {},
    stringTags: visibleStringTags ?? {},
    booleanTags: visibleBooleanTags ?? {},
    traceItemType: TraceItemDataset.TRACEMETRICS,
    hideEmptyOption: true,
  });

  const isLoading = numberTagsLoading || stringTagsLoading || booleanTagsLoading;

  const handleChange = useCallback(
    (selectedOptions: Array<SelectOption<string>>) => {
      const newGroupBys = selectedOptions.map(option => option.value);
      // Check if any new items were added (not present in the old groupBys)
      const hasNewItems = newGroupBys.some(value => !groupBys.includes(value));
      // Automatically switch to aggregates mode when a group by is inserted/updated
      if (hasNewItems) {
        setGroupBys(newGroupBys, Mode.AGGREGATE);
      } else {
        setGroupBys(newGroupBys);
      }
    },
    [groupBys, setGroupBys]
  );

  return (
    <CompactSelect
      multiple
      search
      clearable
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          prefix={t('Group by')}
          style={{width: '100%'}}
        />
      )}
      options={enabledOptions}
      value={[...groupBys]}
      loading={isLoading}
      disabled={!skipTraceMetricFilter && !traceMetricFilter}
      onChange={handleChange}
      style={{width: '100%'}}
    />
  );
}
