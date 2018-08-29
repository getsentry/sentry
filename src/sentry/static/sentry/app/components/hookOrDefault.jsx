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
 *
 */

function HookOrDefault({hookName, defaultComponent, organization}) {
  const HookOrDefaultComponent = createReactClass({
    displayName: 'HookOrDefaultComponent',
    mixins: [Reflux.listenTo(HookStore, 'handleHooks')],

    getInitialState() {
      return {
        hooks: HookStore.get(hookName),
      };
    },

    handleHooks(hookNameFromStore, hooks) {
      // Make sure that the incoming hook update matches this component's hook name
      if (hookName !== hookNameFromStore) return;

      this.setState(state => ({
        hooks,
      }));
    },

    render() {
      let HookComponent =
        this.state.hooks && this.state.hooks.length > 0
          ? this.state.hooks[0]()
          : defaultComponent;
      return (
        <HookComponent
          {...this.props}
          defaultComponent={defaultComponent}
          organization={organization}
        />
      );
    },
  });
  return HookOrDefaultComponent;
}

export default HookOrDefault;
