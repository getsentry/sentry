import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import HookStore from 'app/stores/hookStore';

/**
 * Use this instead of the usual ternery operator when using getsentry hooks. So in lieu of
 *		HookStore.get('component:org-auth-view').length
 *		 ? HookStore.get('component:org-auth-view')[0]()
 *		 : OrganizationAuth
 *
 * do this instead
 *  	HookOrDefault({hookName:'component:org-auth-view', defaultComponent: OrganizationAuth})
 *
 *
 * Note, you will need to add the hookstore function in getsentry first and then register
 * it within sentry as a validHookName
 * See: https://github.com/getsentry/getsentry/blob/master/static/getsentry/gsApp/index.jsx
 *		/app/stores/hookStore.jsx
 *
 * @param {String} name The name of the hook as listed in hookstore.add(hookName, callback)
 * @param {Component} defaultComponent Component that will be shown if no hook is available
 * @param {Function} defaultComponentPromise This is a function that returns a promise (more
 *                   specifically a function that returns the result of a dynamic import using
 *                   `import()`. This will use React.Suspense and React.lazy to render the component.
 *
 */

function HookOrDefault({hookName, defaultComponent, defaultComponentPromise, params}) {
  const HookOrDefaultComponent = createReactClass({
    displayName: `HookOrDefaultComponent(${hookName})`,
    mixins: [Reflux.listenTo(HookStore, 'handleHooks')],

    getInitialState() {
      return {
        hooks: HookStore.get(hookName),
      };
    },

    handleHooks(hookNameFromStore, hooks) {
      // Make sure that the incoming hook update matches this component's hook name
      if (hookName !== hookNameFromStore) {
        return;
      }

      this.setState({
        hooks,
      });
    },

    getDefaultComponent() {
      // If `defaultComponentPromise` is passed, then return a Suspended component
      if (defaultComponentPromise) {
        const Component = React.lazy(defaultComponentPromise);
        return props => (
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
  return HookOrDefaultComponent;
}

export default HookOrDefault;
