import type {OverrideName, Overrides} from 'sentry/types/overrides';

/**
 * The override registry is the mechanism that allows the getsentry (SaaS) frontend
 * to extend and override behavior in the open-source sentry frontend.
 *
 * Overrides are registered once at application startup via registerOverrides() in
 * gsApp/registerOverrides.tsx, before React renders.
 *
 * Override types are defined in sentry/types/overrides.tsx.
 */
const registry = new Map<OverrideName, Overrides[OverrideName]>();

/**
 * Register a override implementation. Called once per override at app startup.
 */
export function registerOverride<H extends OverrideName>(
  name: H,
  override: Overrides[H]
): void {
  registry.set(name, override);
}

/**
 * Retrieve a registered override implementation, or undefined if not registered.
 * Most call sites provide a fallback with `?? defaultImpl`.
 */
export function getOverride<H extends OverrideName>(name: H): Overrides[H] | undefined {
  return registry.get(name) as Overrides[H] | undefined;
}
