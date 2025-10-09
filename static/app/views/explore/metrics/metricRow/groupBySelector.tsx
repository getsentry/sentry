import {useMemo} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import type {SelectOption} from 'sentry/components/core/compactSelect/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useMetricAttributeKeys} from 'sentry/views/explore/metrics/metricRow/useMetricAttributeKeys';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface GroupBySelectorProps {
  /**
   * The metric name to filter attributes by
   */
  metricName: string;
  /**
   * Callback when the selection changes
   */
  onChange: (value: string) => void;
  /**
   * The current selected group by value
   */
  value: string;
  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;
}

/**
 * A selector component for choosing metric group by attributes.
 * Fetches available attribute keys from the trace-items API endpoint
 * and displays them as options in a compact select dropdown.
 */
export function GroupBySelector({
  value,
  metricName,
  onChange,
  disabled = false,
}: GroupBySelectorProps) {
  const {
    attributes: numberTags,
    isLoading: numberTagsLoading,
    error: numberTagsError,
  } = useMetricAttributeKeys({
    metricName,
    enabled: true,
    type: 'number',
  });
  const {
    attributes: stringTags,
    isLoading: stringTagsLoading,
    error: stringTagsError,
  } = useMetricAttributeKeys({
    metricName,
    enabled: true,
    type: 'string',
  });

  const enabledOptions: Array<SelectOption<string>> = useGroupByFields({
    groupBys: [],
    numberTags: numberTags ?? {},
    stringTags: stringTags ?? {},
    traceItemType: TraceItemDataset.TRACEMETRICS,
    hideEmptyOption: true,
  });

  const options = useMemo((): Array<SelectOption<string>> => {
    if (!enabledOptions) {
      return [];
    }

    return Object.values(enabledOptions).map((attr: SelectOption<string>) => ({
      label: attr.label,
      value: attr.value,
    }));
  }, [enabledOptions]);

  const handleChange = (option: SelectOption<string>) => {
    onChange(option.value);
  };

  const isLoading = numberTagsLoading || stringTagsLoading;
  const error = numberTagsError || stringTagsError;
  const triggerLabel = isLoading ? (
    <LoadingIndicator mini />
  ) : error ? (
    t('Error loading attributes')
  ) : undefined;

  return (
    <CompactSelect
      options={options}
      value={value}
      onChange={handleChange}
      disabled={disabled || isLoading}
      triggerProps={triggerLabel ? {children: triggerLabel} : undefined}
    />
  );
}
