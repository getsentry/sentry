import {FieldValueType} from 'sentry/utils/fields';
import type {SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

import {FilterSelector} from './filterSelector';
import {NumericFilterSelector} from './numericFilterSelector';
import {getFieldDefinitionForDataset} from './utils';

export type GenericFilterSelectorProps = {
  globalFilter: GlobalFilter;
  onRemoveFilter: (filter: GlobalFilter) => void;
  onUpdateFilter: (filter: GlobalFilter) => void;
  searchBarData: SearchBarData;
  disableRemoveFilter?: boolean;
  /**
   * Show the filter's dataset inline in the trigger. Used when another filter
   * on the dashboard has the same key but a different dataset.
   */
  showDatasetLabel?: boolean;
};

export function GenericFilterSelector({
  globalFilter,
  ...props
}: GenericFilterSelectorProps) {
  const fieldDefinition = getFieldDefinitionForDataset(
    globalFilter.tag,
    globalFilter.dataset
  );
  const isNumericType =
    fieldDefinition?.valueType === FieldValueType.NUMBER ||
    fieldDefinition?.valueType === FieldValueType.DURATION;
  const Component = isNumericType ? NumericFilterSelector : FilterSelector;
  return <Component globalFilter={globalFilter} {...props} />;
}
