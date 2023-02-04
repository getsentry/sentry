import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {DataCategoryInfo} from 'sentry/types';

/**
 * Convert a data category plural to a DataCategoryInfo object, if found in DATA_CATEGORY_INFO
 */
export function getCategoryInfo(
  dataCategoryPlural?: DataCategoryInfo['plural']
): DataCategoryInfo | undefined {
  return Object.values(DATA_CATEGORY_INFO).find(
    info => info.plural === dataCategoryPlural
  );
}
