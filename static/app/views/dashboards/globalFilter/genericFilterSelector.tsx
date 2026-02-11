import {FieldValueType} from 'sentry/utils/fields';
import type {SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import FilterSelector from 'sentry/views/dashboards/globalFilter/filterSelector';
import NumericFilterSelector from 'sentry/views/dashboards/globalFilter/numericFilterSelector';
import {getFieldDefinitionForDataset} from 'sentry/views/dashboards/globalFilter/utils';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

export type GenericFilterSelectorProps = {
  globalFilter: GlobalFilter;
  onRemoveFilter: (filter: GlobalFilter) => void;
  onUpdateFilter: (filter: GlobalFilter) => void;
  searchBarData: SearchBarData;
  disableRemoveFilter?: boolean;
};

function getFilterSelector(
  globalFilter: GlobalFilter
): React.ComponentType<GenericFilterSelectorProps> {
  const fieldDefinition = getFieldDefinitionForDataset(
    globalFilter.tag,
    globalFilter.dataset
  );
  switch (fieldDefinition?.valueType) {
    case FieldValueType.NUMBER:
    case FieldValueType.DURATION:
      return NumericFilterSelector;
    case FieldValueType.STRING:
    default:
      return FilterSelector;
  }
}

function GenericFilterSelector({globalFilter, ...props}: GenericFilterSelectorProps) {
  const FilterSelectorForType = getFilterSelector(globalFilter);
  return <FilterSelectorForType globalFilter={globalFilter} {...props} />;
}

export default GenericFilterSelector;
