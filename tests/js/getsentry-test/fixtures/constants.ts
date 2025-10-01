import {DataCategory} from 'sentry/types/core';

import {AddOnCategory} from 'getsentry/types';

// TODO(isabella): update this with other common constants in the fixtures

export const AM_ADD_ON_CATEGORIES = {
  [AddOnCategory.SEER]: {
    apiName: AddOnCategory.SEER,
    dataCategories: [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER],
    name: 'seer',
    billingFlag: 'seer-billing',
    order: 1,
    productName: 'Seer',
  },
  [AddOnCategory.PREVENT]: {
    apiName: AddOnCategory.PREVENT,
    dataCategories: [DataCategory.PREVENT_USER, DataCategory.PREVENT_REVIEW],
    name: 'prevent',
    billingFlag: 'prevent-billing',
    order: 2,
    productName: 'prevent',
  },
};
