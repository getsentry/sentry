import {MetricsApiResponse} from 'sentry/types';

import {TableData} from '../discover/discoverQuery';
import {getAggregateAlias, getAggregateArg} from '../discover/fields';

import {
  convertMetricsGroupBysToDiscoverFields,
  convertMetricsToDiscoverFields,
  METRIC_TO_COLUMN_TYPE,
} from './fields';

type Arguments = {
  response: MetricsApiResponse | null;
};

function renameObjectKeys(
  obj: Record<string, number | string | null>,
  renameFunc: (key: string) => string
) {
  return Object.keys(obj).reduce((acc, key) => {
    const discoverKey = getAggregateAlias(renameFunc(key));
    if (discoverKey) {
      acc[discoverKey] = obj[key];
    }

    return acc;
  }, {});
}

function changeObjectValuesToTypes(obj: Record<string, number | string | null>) {
  return Object.keys(obj).reduce((acc, key) => {
    acc[key] = METRIC_TO_COLUMN_TYPE[getAggregateArg(key) ?? key] ?? 'number';
    return acc;
  }, {});
}

/**
 * This function was used for performance table on metrics PoC.
 * The transform that renames the fields will be handled on the API layer.
 * @deprecated
 */
export function deprecatedTransformMetricsResponseToTable({
  response,
}: Arguments): TableData {
  const data =
    response?.groups.map((group, index) => ({
      id: String(index),
      ...renameObjectKeys(group.by, convertMetricsGroupBysToDiscoverFields),
      ...renameObjectKeys(group.totals, convertMetricsToDiscoverFields),
    })) ?? [];

  const meta = {
    ...renameObjectKeys(
      changeObjectValuesToTypes(response?.groups[0]?.by ?? {}),
      convertMetricsGroupBysToDiscoverFields
    ),
    ...renameObjectKeys(
      changeObjectValuesToTypes(response?.groups[0]?.totals ?? {}),
      convertMetricsToDiscoverFields
    ),
  };

  return {
    data,
    meta,
  };
}
