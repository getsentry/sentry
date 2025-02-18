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

// Supported Feature Flag Providers. Ordered by display order in FeatureFlagOnboardingDrawer.
export enum ProviderEnum {
  LAUNCHDARKLY = 'LaunchDarkly',
  STATSIG = 'Statsig',
  UNLEASH = 'Unleash',
  GENERIC = 'Generic',
}

// Feature Flag SDKs we support integrations for. Ordered by display order in FeatureFlagOnboardingDrawer.
export enum SdkIntegrationEnum {
  LAUNCHDARKLY = 'LaunchDarkly',
  OPENFEATURE = 'OpenFeature',
  STATSIG = 'Statsig',
  UNLEASH = 'Unleash',
  GENERIC = 'Generic',
}

export const PROVIDER_TO_SETUP_WEBHOOK_URL: Record<ProviderEnum, string> = {
  [ProviderEnum.GENERIC]:
    'https://docs.sentry.io/organization/integrations/feature-flag/generic/#set-up-change-tracking',
  [ProviderEnum.LAUNCHDARKLY]:
    'https://app.launchdarkly.com/settings/integrations/webhooks/new?q=Webhooks',
  [ProviderEnum.STATSIG]:
    'https://docs.sentry.io/organization/integrations/feature-flag/statsig/#set-up-change-tracking',
  [ProviderEnum.UNLEASH]:
    'https://docs.sentry.io/organization/integrations/feature-flag/unleash/#set-up-change-tracking',
};
