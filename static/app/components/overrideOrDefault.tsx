import type {ComponentProps} from 'react';
import {lazy, Suspense} from 'react';

import {getOverride} from 'sentry/overrideRegistry';
import type {OverrideName, Overrides} from 'sentry/types/overrides';

interface Params<H extends OverrideName> {
  /**
   * The name of the override as listed in overrideRegistry.registerOverride(overrideName, callback)
   */
  overrideName: H;
  /**
   * Component that will be shown if no hook is available
   */
  defaultComponent?: ReturnType<Overrides[H]> | (() => ReturnType<Overrides[H]>);
  /**
   * This is a function that returns a promise (more specifically a function
   * that returns the result of a dynamic import using `import()`. This will
   * use React.Suspense and React.lazy to render the component.
   */
  defaultComponentPromise?: () => Promise<ReturnType<Overrides[H]>>;
}

/**
 * Use this instead of the usual ternary operator when using getsentry overrides.
 * So in lieu of:
 *
 *  getOverride('component:org-auth-view')?.() ?? OrganizationAuth
 *
 * do this instead:
 *
 *   const OverriddenOrganizationAuth = OverrideOrDefault({
 *     overrideName:'component:org-auth-view',
 *     defaultComponent: OrganizationAuth,
 *   })
 *
 * Note, you will need to register the override in gsApp/registerOverrides.tsx and
 * add the type to sentry/types/overrides.tsx.
 */
export function OverrideOrDefault<H extends OverrideName>({
  overrideName,
  defaultComponent,
  defaultComponentPromise,
}: Params<H>): React.FunctionComponent<ComponentProps<ReturnType<Overrides[H]>>> {
  type Props = ComponentProps<ReturnType<Overrides[H]>>;

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

  const ResolvedComponent: React.ComponentType<any> | undefined =
    getOverride(overrideName)?.() ?? getDefaultComponent();

  function OverrideOrDefaultComponent(props: Props) {
    if (!ResolvedComponent) {
      return null;
    }

    return <ResolvedComponent {...props} />;
  }

  OverrideOrDefaultComponent.displayName = `OverrideOrDefaultComponent(${overrideName})`;

  return OverrideOrDefaultComponent;
}
