import {useCallback, useMemo} from 'react';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import type {SelectOption} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
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
  const organization = useOrganization();
  const hasBooleanFilters = organization.features.includes(
    'search-query-builder-explicit-boolean-filters'
  );

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
  const {attributes: booleanTags, isLoading: booleanTagsLoading} =
    useTraceItemAttributeKeys({
      traceItemType: TraceItemDataset.TRACEMETRICS,
      type: 'boolean',
      enabled: Boolean(traceMetricFilter) && hasBooleanFilters,
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

  const visibleBooleanTags = useMemo(() => {
    return Object.fromEntries(
      Object.entries(booleanTags ?? {}).filter(
        ([key]) => !HiddenTraceMetricGroupByFields.includes(key)
      )
    );
  }, [booleanTags]);

  const enabledOptions: Array<SelectOption<string>> = useGroupByFields({
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
      searchable
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
      disabled={enabledOptions.length === 0}
      onChange={handleChange}
      style={{width: '100%'}}
    />
  );
}
