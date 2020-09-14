import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import HookStore from 'app/stores/hookStore';
import {Hooks, HookName} from 'app/types/hooks';

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
  /**
   * Parameters to pass into the hook callback
   */
  params?: Parameters<Hooks[H]>;
};

type State<H extends HookName> = {
  hooks: Array<Hooks[H]>;
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
 * then register tye types [2] and validHookName [1] in sentry.
 *
 * [0] /getsentry/static/getsentry/gsApp/registerHooks.jsx
 * [1] /sentry/app/stores/hookStore.tsx
 * [2] /sentry/app/types/hooks.ts
 */
function HookOrDefault<H extends HookName>({
  hookName,
  defaultComponent,
  defaultComponentPromise,
  params,
}: Params<H>) {
  type Props = React.ComponentProps<ReturnType<Hooks[H]>>;

  return createReactClass<Props, State<H>>({
    displayName: `HookOrDefaultComponent(${hookName})`,
    mixins: [Reflux.listenTo(HookStore, 'handleHooks') as any],

    getInitialState() {
      return {hooks: HookStore.get(hookName)};
    },

    handleHooks(hookNameFromStore: HookName, hooks: Array<Hooks[H]>) {
      // Make sure that the incoming hook update matches this component's hook name
      if (hookName !== hookNameFromStore) {
        return;
      }

      this.setState({hooks});
    },

    getDefaultComponent() {
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
    },

    render() {
      const hookExists = this.state.hooks && this.state.hooks.length;
      const HookComponent =
        hookExists && this.state.hooks[0]({params})
          ? this.state.hooks[0]({params})
          : this.getDefaultComponent();

      return <HookComponent {...this.props} />;
    },
  });
}

export default HookOrDefault;
