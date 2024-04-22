const referrerPrefix = 'api.performance.cache';

enum ReferrerSuffix {
  LANDING_CACHE_HIT_MISS_CHART = `landing-cache-hit-miss-chart`,
  LANDING_CACHE_THROUGHPUT_CHART = `landing-cache-throughput-chart`,
}

type PrefixedReferrer = {
  [key in keyof typeof ReferrerSuffix]: `${typeof referrerPrefix}.${(typeof ReferrerSuffix)[key]}`;
};

export const Referrer: PrefixedReferrer = ReferrerSuffix as unknown as PrefixedReferrer;
