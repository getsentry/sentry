import * as React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {HookName, Hooks} from 'app/types/hooks';
import HookStore from 'app/stores/hookStore';

type Props<H extends HookName> = {
  /**
   * The name of the hook as listed in hookstore.add(hookName, callback)
   */
  name: H;
  /**
   * If children are provided as a function to the Hook, the hooks will be
   * passed down as a render prop.
   */
  children?: (opts: {hooks: Array<Hooks[H]>}) => React.ReactNode;
} & Omit<Parameters<Hooks[H]>[0], 'name'>;

/**
 * Instead of accessing the HookStore directly, use this.
 *
 * If the hook slot needs to perform anything w/ the hooks, you can pass a
 * function as a child and you will receive an object with a `hooks` key
 *
 * Example:
 *
 *   <Hook name="my-hook">
 *     {({hooks}) => hooks.map(hook => (
 *       <Wrapper>{hook}</Wrapper>
 *     ))}
 *   </Hook>
 */
function Hook<H extends HookName>({name, ...props}: Props<H>) {
  const HookComponent = createReactClass({
    displayName: `Hook(${name})`,
    mixins: [Reflux.listenTo(HookStore, 'handleHooks') as any],

    getInitialState() {
      return {hooks: HookStore.get(name).map(cb => cb(props))};
    },

    handleHooks(hookName: HookName, hooks: Array<Hooks[H]>) {
      // Make sure that the incoming hook update matches this component's hook name
      if (hookName !== name) {
        return;
      }

      this.setState({hooks: hooks.map(cb => cb(props))});
    },

    render() {
      const {children} = props;

      if (!this.state.hooks || !this.state.hooks.length) {
        return null;
      }

      if (typeof children === 'function') {
        return children({hooks: this.state.hooks});
      }

      return this.state.hooks;
    },
  });

  return <HookComponent />;
}

export default Hook;
