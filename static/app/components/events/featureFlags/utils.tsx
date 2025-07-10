import type {KeyValueDataContentProps} from 'sentry/components/keyValueData';
import {t} from 'sentry/locale';

export enum OrderBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  A_TO_Z = 'a-z',
  Z_TO_A = 'z-a',
  HIGH_TO_LOW = 'high to low',
  LOW_TO_HIGH = 'low to high',
}

export enum SortBy {
  EVAL_ORDER = 'eval',
  ALPHABETICAL = 'alphabetical',
  SUSPICION = 'suspicion',
  DISTRIBUTION = 'distribution',
}

export const getSelectionType = (selection: string): SortBy => {
  switch (selection) {
    case OrderBy.HIGH_TO_LOW:
    case OrderBy.LOW_TO_HIGH:
      return SortBy.DISTRIBUTION;
    case OrderBy.A_TO_Z:
    case OrderBy.Z_TO_A:
      return SortBy.ALPHABETICAL;
    case OrderBy.OLDEST:
    case OrderBy.NEWEST:
    default:
      return SortBy.EVAL_ORDER;
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
    case SortBy.DISTRIBUTION:
      return t('Distribution');
    case SortBy.SUSPICION:
      return t('Suspiciousness');
    case SortBy.EVAL_ORDER:
    default:
      return t('Evaluation Order');
  }
};

export const getDefaultOrderBy = (sortBy: SortBy): OrderBy => {
  switch (sortBy) {
    case SortBy.DISTRIBUTION:
    case SortBy.SUSPICION:
      return OrderBy.HIGH_TO_LOW;
    case SortBy.EVAL_ORDER:
      return OrderBy.NEWEST;
    case SortBy.ALPHABETICAL:
    default:
      return OrderBy.A_TO_Z;
  }
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

const handleSortAlphabetical = (flags: KeyValueDataContentProps[]) => {
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

// Supported Feature Flag Providers. Ordered by display order in FeatureFlagOnboardingDrawer. We prefer Generic to be last.
export enum WebhookProviderEnum {
  LAUNCHDARKLY = 'LaunchDarkly',
  STATSIG = 'Statsig',
  UNLEASH = 'Unleash',
  GENERIC = 'Generic',
}

// Supported Feature Flag SDKs. Ordered by display order in FeatureFlagOnboardingDrawer. We prefer Generic to be last.
export enum SdkProviderEnum {
  LAUNCHDARKLY = 'LaunchDarkly',
  OPENFEATURE = 'OpenFeature',
  STATSIG = 'Statsig',
  UNLEASH = 'Unleash',
  GENERIC = 'Generic',
}

export const PROVIDER_TO_SETUP_WEBHOOK_URL: Record<WebhookProviderEnum, string> = {
  [WebhookProviderEnum.GENERIC]:
    'https://docs.sentry.io/organization/integrations/feature-flag/generic/#set-up-change-tracking',
  [WebhookProviderEnum.LAUNCHDARKLY]:
    'https://app.launchdarkly.com/settings/integrations/webhooks/new?q=Webhooks',
  [WebhookProviderEnum.STATSIG]: 'https://console.statsig.com/integrations', // Expecting this to redirect to /<proj-id>/integrations
  [WebhookProviderEnum.UNLEASH]:
    'https://docs.sentry.io/organization/integrations/feature-flag/unleash/#set-up-change-tracking',
};

// Issues search backend expects a certain format for feature flag search keys.
export function makeFeatureFlagSearchKey(flagKey: string) {
  return `flags[${flagKey}]`;
}
