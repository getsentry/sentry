import type {ComponentProps} from 'react';
import {lazy, Suspense, useEffect, useState} from 'react';

import {HookStore} from 'sentry/stores/hookStore';
import type {HookName, Hooks} from 'sentry/types/hooks';

interface Params<H extends HookName> {
  /**
   * The name of the hook as listed in hookstore.add(hookName, callback)
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
 * Use this instead of the usual ternery operator when using getsentry hooks.
 * So in lieu of:
 *
 *  HookStore.get('component:org-auth-view')?.() ?? OrganizationAuth
 *
 * do this instead:
 *
 *   const HookedOrganizationAuth = HookOrDefault({
 *     hookName:'component:org-auth-view',
 *     defaultComponent: OrganizationAuth,
 *   })
 *
 * Note, you will need to add the hookstore function in getsentry [0] first and
 * then register the types [2] and validHookName [1] in sentry.
 *
 * [0] /getsentry/static/getsentry/gsApp/registerHooks.jsx
 * [1] /sentry/app/stores/hookStore.tsx
 * [2] /sentry/app/types/hooks.ts
 */
export function HookOrDefault<H extends HookName>({
  hookName,
  defaultComponent,
  defaultComponentPromise,
}: Params<H>): React.FunctionComponent<ComponentProps<ReturnType<Hooks[H]>>> {
  type Props = ComponentProps<ReturnType<Hooks[H]>>;

  // Defining the props here is unnecessary and slow for typescript
  function getDefaultComponent(): React.ComponentType<any> | undefined {
    // If `defaultComponentPromise` is passed, then return a Suspended component
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
    // Wrap in a thunk: useState(fn) calls fn() as a lazy initializer, so storing
    // a function as state requires the () => fn pattern throughout.
    const [hook, setHook] = useState(() => HookStore.get(hookName));

    useEffect(() => {
      const unsubscribe = HookStore.listen(
        (name: string, newHook: Hooks[H] | undefined) => {
          if (name === hookName) {
            setHook(() => newHook);
          }
        },
        undefined
      );

      return () => {
        unsubscribe();
      };
    }, []);

    // Defining the props here is unnecessary and slow for typescript
    const HookComponent: React.ComponentType<any> = hook?.() ?? getDefaultComponent();

    if (!HookComponent) {
      return null;
    }

    return <HookComponent {...props} />;
  }

  HookOrDefaultComponent.displayName = `HookOrDefaultComponent(${hookName})`;

  return HookOrDefaultComponent;
}
