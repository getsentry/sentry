import {DataCategory} from 'sentry/types/core';

import {AddOnCategory, type AddOnCategoryInfo} from 'getsentry/types';

// TODO(isabella): update this with other common constants in the fixtures

export const AM_ADD_ON_CATEGORIES: Record<AddOnCategory, AddOnCategoryInfo> = {
  [AddOnCategory.SEER]: {
    apiName: AddOnCategory.SEER,
    dataCategories: [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER],
    name: 'seer',
    order: 1,
    productName: 'Seer',
    billingFlag: 'seer-billing',
  },
  [AddOnCategory.PREVENT]: {
    apiName: AddOnCategory.PREVENT,
    dataCategories: [DataCategory.PREVENT_USER, DataCategory.PREVENT_REVIEW],
    name: 'prevent',
    order: 2,
    productName: 'prevent',
    billingFlag: 'prevent-billing',
  },
};
