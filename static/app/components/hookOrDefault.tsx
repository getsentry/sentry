import * as React from 'react';

import HookStore from 'app/stores/hookStore';
import {HookName, Hooks} from 'app/types/hooks';

type Params<H extends HookName> = {
  /**
   * The name of the hook as listed in hookstore.add(hookName, callback)
   */
  hookName: H;
  /**
   * Component that will be shown if no hook is available
   */
  defaultComponent?: ReturnType<Hooks[H]>;
  /**
   * This is a function that returns a promise (more specifically a function
   * that returns the result of a dynamic import using `import()`. This will
   * use React.Suspense and React.lazy to render the component.
   */
  defaultComponentPromise?: () => Promise<ReturnType<Hooks[H]>>;
};

/**
 * Use this instead of the usual ternery operator when using getsentry hooks.
 * So in lieu of:
 *
 *  HookStore.get('component:org-auth-view').length
 *   ? HookStore.get('component:org-auth-view')[0]()
 *   : OrganizationAuth
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
function HookOrDefault<H extends HookName>({
  hookName,
  defaultComponent,
  defaultComponentPromise,
}: Params<H>) {
  type Props = React.ComponentProps<ReturnType<Hooks[H]>>;
  type State = {hooks: Hooks[H][]};

  class HookOrDefaultComponent extends React.Component<Props, State> {
    static displayName = `HookOrDefaultComponent(${hookName})`;

    state: State = {
      hooks: HookStore.get(hookName),
    };

    componentWillUnmount() {
      this.unlistener?.();
    }

    unlistener = HookStore.listen(
      (name: string, hooks: Hooks[HookName][]) =>
        name === hookName && this.setState({hooks}),
      undefined
    );

    get defaultComponent() {
      // If `defaultComponentPromise` is passed, then return a Suspended component
      if (defaultComponentPromise) {
        const Component = React.lazy(defaultComponentPromise);

        return (props: Props) => (
          <React.Suspense fallback={null}>
            <Component {...props} />
          </React.Suspense>
        );
      }

      return defaultComponent;
    }

    render() {
      const hookExists = this.state.hooks && this.state.hooks.length;
      const componentFromHook = this.state.hooks[0]?.();
      const HookComponent =
        hookExists && componentFromHook ? componentFromHook : this.defaultComponent;

      return HookComponent ? <HookComponent {...this.props} /> : null;
    }
  }

  return HookOrDefaultComponent;
}

export default HookOrDefault;
