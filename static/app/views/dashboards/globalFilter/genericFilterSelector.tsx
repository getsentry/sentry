import {FieldValueType} from 'sentry/utils/fields';
import {useFieldDefinitionGetter} from 'sentry/utils/fields/hooks';
import type {SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import FilterSelector from 'sentry/views/dashboards/globalFilter/filterSelector';
import NumericFilterSelector from 'sentry/views/dashboards/globalFilter/numericFilterSelector';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

import {getFieldType} from './utils';

export type GenericFilterSelectorProps = {
  globalFilter: GlobalFilter;
  onRemoveFilter: (filter: GlobalFilter) => void;
  onUpdateFilter: (filter: GlobalFilter) => void;
  searchBarData: SearchBarData;
  disableRemoveFilter?: boolean;
};

function GenericFilterSelector({globalFilter, ...props}: GenericFilterSelectorProps) {
  const {getFieldDefinition} = useFieldDefinitionGetter();

  const fieldDefinition = getFieldDefinition(
    globalFilter.tag.key,
    getFieldType(globalFilter.dataset),
    globalFilter.tag.kind
  );

  switch (fieldDefinition?.valueType) {
    case FieldValueType.NUMBER:
    case FieldValueType.DURATION:
      return <NumericFilterSelector globalFilter={globalFilter} {...props} />;
    case FieldValueType.STRING:
    default:
      return <FilterSelector globalFilter={globalFilter} {...props} />;
  }
}

export default GenericFilterSelector;
