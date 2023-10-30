import {TableData} from 'sentry/utils/discover/discoverQuery';
import {GenericChildrenProps} from 'sentry/utils/discover/genericDiscoverQuery';

import {
  QueryDefinitionWithKey,
  WidgetDataConstraint,
  WidgetDataResult,
  WidgetPropUnion,
} from '../types';

export function transformDiscoverToSingleValue<T extends WidgetDataConstraint>(
  _widgetProps: WidgetPropUnion<T>,
  results: GenericChildrenProps<TableData>,
  _: QueryDefinitionWithKey<T>
): WidgetDataResult {
  const data = results.tableData?.data?.[0]; // The discover query is not aggregated on any field, therefore there is only one element in the table

  return {
    isLoading: results.isLoading,
    isErrored: !!results.error,
    hasData: !!data,
    ...data,
  };
}
