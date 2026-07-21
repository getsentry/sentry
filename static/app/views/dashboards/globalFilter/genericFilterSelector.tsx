import {FieldValueType} from 'sentry/utils/fields';
import type {SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import {FilterSelector} from 'sentry/views/dashboards/globalFilter/filterSelector';
import {NumericFilterSelector} from 'sentry/views/dashboards/globalFilter/numericFilterSelector';
import {getFieldDefinitionForDataset} from 'sentry/views/dashboards/globalFilter/utils';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

export type GenericFilterSelectorProps = {
  globalFilter: GlobalFilter;
  onRemoveFilter: (filter: GlobalFilter) => void;
  onUpdateFilter: (filter: GlobalFilter) => void;
  searchBarData: SearchBarData;
  disableRemoveFilter?: boolean;
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
