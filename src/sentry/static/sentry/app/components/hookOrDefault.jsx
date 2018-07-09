import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import HookStore from 'app/stores/hookStore';

function HookOrDefault({hookName, defaultComponent}) {

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
	    let HookComponent = this.state.hooks && this.state.hooks.length > 0 ? this.state.hooks[0]() : defaultComponent;
	    return <HookComponent {...this.props}/>;
	  },
	});
	return HookOrDefaultComponent;
}

export default HookOrDefault;
