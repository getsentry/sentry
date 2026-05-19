import type {HookName, Hooks} from 'sentry/types/hooks';

/**
 * The hook registry is the mechanism that allows the getsentry (SaaS) frontend
 * to extend and override behavior in the open-source sentry frontend.
 *
 * Hooks are registered once at application startup via registerHooks() in
 * gsApp/registerHooks.tsx, before React renders.
 *
 * Hook types are defined in sentry/types/hooks.tsx.
 */
const registry = new Map<HookName, Hooks[HookName]>();

/**
 * Register a hook implementation. Called once per hook at app startup.
 */
export function registerHook<H extends HookName>(name: H, hook: Hooks[H]): void {
  registry.set(name, hook);
}

/**
 * Retrieve a registered hook implementation, or undefined if not registered.
 * Most call sites provide a fallback with `?? defaultImpl`.
 */
export function getHook<H extends HookName>(name: H): Hooks[H] | undefined {
  return registry.get(name) as Hooks[H] | undefined;
}
