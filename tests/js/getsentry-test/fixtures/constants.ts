import {DataCategory} from 'sentry/types/core';

import {AddOnCategory, type AddOnCategoryInfo} from 'getsentry/types';

// TODO(isabella): update this with other common constants in the fixtures

export const AM_ADD_ON_CATEGORIES = {
  [AddOnCategory.LEGACY_SEER]: {
    apiName: AddOnCategory.LEGACY_SEER,
    dataCategories: [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER],
    name: 'legacySeer',
    billingFlag: 'seer-billing',
    order: 1,
    productName: 'Seer',
  },
  [AddOnCategory.SEER]: {
    apiName: AddOnCategory.SEER,
    dataCategories: [DataCategory.SEER_USER],
    name: 'seer',
    billingFlag: 'seer-user-billing',
    order: 2,
    productName: 'Seer',
  },
} satisfies Record<AddOnCategory, AddOnCategoryInfo>;
