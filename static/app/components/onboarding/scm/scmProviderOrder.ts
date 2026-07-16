import type {IntegrationProvider} from 'sentry/types/integrations';

/**
 * Provider keys shown first, in this display order. In ScmProviderPills these
 * render as top-level pill buttons; everything else follows in its original
 * order (grouped into the "More" dropdown there).
 */
const PRIMARY_PROVIDER_KEYS: readonly string[] = ['github', 'gitlab', 'bitbucket'];

/** Sort rank for a provider key: primaries by their index, everything else after. */
function providerOrderRank(key: string): number {
  const index = PRIMARY_PROVIDER_KEYS.indexOf(key);
  return index === -1 ? PRIMARY_PROVIDER_KEYS.length : index;
}

/**
 * Stable-sorts items into the canonical SCM provider display order -- primary
 * providers first (in PRIMARY_PROVIDER_KEYS order), then the rest in their
 * original order -- keyed by each item's provider key. Used for both provider
 * lists and integration lists so they share one ordering.
 */
export function sortByScmProviderOrder<T>(items: T[], getKey: (item: T) => string): T[] {
  return [...items].sort(
    (a, b) => providerOrderRank(getKey(a)) - providerOrderRank(getKey(b))
  );
}

/**
 * Splits SCM providers into the primary set (in PRIMARY_PROVIDER_KEYS order)
 * and the rest (in their original order), for ScmProviderPills' pills vs.
 * "More" dropdown grouping. Provider configs are unique by key, so
 * concatenating the two yields the same order as {@link sortByScmProviderOrder}.
 */
export function partitionScmProviders(providers: IntegrationProvider[]) {
  const primaryProviders = PRIMARY_PROVIDER_KEYS.map(key =>
    providers.find(p => p.key === key)
  ).filter((p): p is IntegrationProvider => p !== undefined);
  const moreProviders = providers.filter(p => !PRIMARY_PROVIDER_KEYS.includes(p.key));
  return {primaryProviders, moreProviders};
}
