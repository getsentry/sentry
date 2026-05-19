import type {ComponentProps} from 'react';
import {lazy, Suspense} from 'react';

import {getHook} from 'sentry/hookRegistry';
import type {HookName, Hooks} from 'sentry/types/hooks';

interface Params<H extends HookName> {
  /**
   * The name of the hook as listed in hookRegistry.registerHook(hookName, callback)
   */
  hookName: H;
  /**
   * Component that will be shown if no hook is available
   */
  defaultComponent?: ReturnType<Hooks[H]> | (() => ReturnType<Hooks[H]>);
  /**
   * This is a function that returns a promise (more specifically a function
   * that returns the result of a dynamic import using `import()`. This will
   * use React.Suspense and React.lazy to render the component.
   */
  defaultComponentPromise?: () => Promise<ReturnType<Hooks[H]>>;
}

/**
 * Use this instead of the usual ternary operator when using getsentry hooks.
 * So in lieu of:
 *
 *  getHook('component:org-auth-view')?.() ?? OrganizationAuth
 *
 * do this instead:
 *
 *   const HookedOrganizationAuth = HookOrDefault({
 *     hookName:'component:org-auth-view',
 *     defaultComponent: OrganizationAuth,
 *   })
 *
 * Note, you will need to register the hook in gsApp/registerHooks.tsx and
 * add the type to sentry/types/hooks.tsx.
 */
export function HookOrDefault<H extends HookName>({
  hookName,
  defaultComponent,
  defaultComponentPromise,
}: Params<H>): React.FunctionComponent<ComponentProps<ReturnType<Hooks[H]>>> {
  type Props = ComponentProps<ReturnType<Hooks[H]>>;

  // Defining the props here is unnecessary and slow for typescript
  function getDefaultComponent(): React.ComponentType<any> | undefined {
    if (defaultComponentPromise) {
      // Lazy adds a complicated type that is not important
      const DefaultComponent: React.ComponentType<any> = lazy(defaultComponentPromise);

      return function (props: Props) {
        return (
          <Suspense fallback={null}>
            <DefaultComponent {...props} />
          </Suspense>
        );
      };
    }

    return defaultComponent;
  }

  function HookOrDefaultComponent(props: Props) {
    // Defining the props here is unnecessary and slow for typescript
    const HookComponent: React.ComponentType<any> =
      getHook(hookName)?.() ?? getDefaultComponent();

    if (!HookComponent) {
      return null;
    }

    return <HookComponent {...props} />;
  }

  HookOrDefaultComponent.displayName = `HookOrDefaultComponent(${hookName})`;

  return HookOrDefaultComponent;
}
