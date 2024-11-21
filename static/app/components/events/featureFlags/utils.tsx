import type {KeyValueDataContentProps} from 'sentry/components/keyValueData';
import {t} from 'sentry/locale';

export enum OrderBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  A_TO_Z = 'a-z',
  Z_TO_A = 'z-a',
}

export enum SortBy {
  EVAL_ORDER = 'eval',
  ALPHABETICAL = 'alphabetical',
}

export const getSelectionType = (selection: string) => {
  switch (selection) {
    case OrderBy.A_TO_Z:
    case OrderBy.Z_TO_A:
      return 'alphabetical';
    case OrderBy.OLDEST:
    case OrderBy.NEWEST:
    default:
      return 'eval';
  }
};

const getOrderByLabel = (sort: string) => {
  switch (sort) {
    case OrderBy.A_TO_Z:
      return t('A-Z');
    case OrderBy.Z_TO_A:
      return t('Z-A');
    case OrderBy.OLDEST:
      return t('Oldest First');
    case OrderBy.NEWEST:
    default:
      return t('Newest First');
  }
};

const getSortByLabel = (sort: string) => {
  switch (sort) {
    case SortBy.ALPHABETICAL:
      return t('Alphabetical');
    case SortBy.EVAL_ORDER:
    default:
      return t('Evaluation Order');
  }
};

export const getDefaultOrderBy = (sortBy: SortBy) => {
  return sortBy === SortBy.EVAL_ORDER ? OrderBy.NEWEST : OrderBy.A_TO_Z;
};

export const SORT_BY_OPTIONS = [
  {
    label: getSortByLabel(SortBy.EVAL_ORDER),
    value: SortBy.EVAL_ORDER,
  },
  {
    label: getSortByLabel(SortBy.ALPHABETICAL),
    value: SortBy.ALPHABETICAL,
  },
];

export const ORDER_BY_OPTIONS = [
  {
    label: getOrderByLabel(OrderBy.NEWEST),
    value: OrderBy.NEWEST,
  },
  {
    label: getOrderByLabel(OrderBy.OLDEST),
    value: OrderBy.OLDEST,
  },
  {
    label: getOrderByLabel(OrderBy.A_TO_Z),
    value: OrderBy.A_TO_Z,
  },
  {
    label: getOrderByLabel(OrderBy.Z_TO_A),
    value: OrderBy.Z_TO_A,
  },
];

export const enum FlagControlOptions {
  SEARCH = 'search',
  SORT = 'sort',
}

export const handleSortAlphabetical = (flags: KeyValueDataContentProps[]) => {
  return [...flags].sort((a, b) => {
    return a.item.key.localeCompare(b.item.key);
  });
};

export const sortedFlags = ({
  flags,
  sort,
}: {
  flags: KeyValueDataContentProps[];
  sort: OrderBy;
}): KeyValueDataContentProps[] => {
  switch (sort) {
    case OrderBy.A_TO_Z:
      return handleSortAlphabetical(flags);
    case OrderBy.Z_TO_A:
      return [...handleSortAlphabetical(flags)].reverse();
    case OrderBy.OLDEST:
      return [...flags].reverse();
    default:
      return flags;
  }
};

export enum ProviderOptions {
  LAUNCHDARKLY = 'LaunchDarkly',
  OPENFEATURE = 'OpenFeature',
}

type Labels = {
  pythonIntegration: string; // what's in the integrations array
  pythonModule: string; // what's imported from sentry_sdk.integrations
};

// to organize this better, we could do something like
// [ProviderOptions.LAUNCHDARKLY]: {
//    python: {
//        module: 'launchdarkly',
//        integration 'LaunchDarklyIntegration',
//    },
//    javascript: {
//        ...
//    }
// }
export const PROVIDER_OPTION_TO_LABELS: Record<ProviderOptions, Labels> = {
  [ProviderOptions.LAUNCHDARKLY]: {
    pythonModule: 'launchdarkly',
    pythonIntegration: 'LaunchDarklyIntegration',
  },
  [ProviderOptions.OPENFEATURE]: {
    pythonModule: 'OpenFeature',
    pythonIntegration: 'OpenFeatureIntegration',
  },
};
