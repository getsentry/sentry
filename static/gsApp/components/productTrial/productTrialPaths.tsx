import {DataCategory} from 'sentry/types/core';

import type {Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';

type Product = {
  categories: DataCategory[];
  product: DataCategory;
};

type Path = string;

const PATHS_FOR_PRODUCT_TRIALS: Record<Path, Product> = {
  '/issues/': {
    product: DataCategory.ERRORS,
    categories: [DataCategory.ERRORS],
  },
  '/performance/': {
    product: DataCategory.TRANSACTIONS,
    categories: [DataCategory.TRANSACTIONS],
  },
  '/performance/database/': {
    product: DataCategory.TRANSACTIONS,
    categories: [DataCategory.TRANSACTIONS],
  },
  '/replays/': {
    product: DataCategory.REPLAYS,
    categories: [DataCategory.REPLAYS],
  },
  '/profiling/': {
    product: DataCategory.PROFILES,
    categories: [DataCategory.PROFILES, DataCategory.TRANSACTIONS],
  },
  '/insights/crons/': {
    product: DataCategory.MONITOR_SEATS,
    categories: [DataCategory.MONITOR_SEATS],
  },
  '/insights/uptime/': {
    product: DataCategory.UPTIME,
    categories: [DataCategory.UPTIME],
  },
  '/traces/': {
    product: DataCategory.TRANSACTIONS,
    categories: [DataCategory.TRANSACTIONS],
  },
};

const PATHS_FOR_PRODUCT_TRIALS_AM3_OVERRIDES: Record<Path, Product> = {
  '/performance/': {
    product: DataCategory.SPANS,
    categories: [DataCategory.SPANS],
  },
  '/performance/database/': {
    product: DataCategory.SPANS,
    categories: [DataCategory.SPANS],
  },
  '/replays/': {
    product: DataCategory.REPLAYS,
    categories: [DataCategory.REPLAYS],
  },
  '/profiling/': {
    product: DataCategory.PROFILES,
    categories: [DataCategory.PROFILE_DURATION, DataCategory.PROFILE_DURATION_UI],
  },
  '/traces/': {
    product: DataCategory.SPANS,
    categories: [DataCategory.SPANS],
  },
};

function normalizePath(path: string): string {
  switch (path) {
    case '/explore/traces/':
      return '/traces/';
    case '/explore/profiling/':
      return '/profiling/';
    case '/explore/replays/':
      return '/replays/';
    default:
      return path;
  }
}

export function getProductForPath(
  subscription: Subscription,
  path: string
): Product | null {
  path = normalizePath(path);

  if (subscription.planTier === PlanTier.AM3) {
    if (PATHS_FOR_PRODUCT_TRIALS_AM3_OVERRIDES.hasOwnProperty(path)) {
      return PATHS_FOR_PRODUCT_TRIALS_AM3_OVERRIDES[path]!;
    }
  }

  return PATHS_FOR_PRODUCT_TRIALS[path] || null;
}
