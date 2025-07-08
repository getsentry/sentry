import {Component, type ComponentType, memo} from 'react';

import HookStore from 'sentry/stores/hookStore';
import type {HookName, Hooks} from 'sentry/types/hooks';

// Only allow hooks that return a React component
type ComponentHookName = {
  [K in HookName]: Hooks[K] extends ComponentType<any> ? K : never;
}[HookName];

type Props<H extends ComponentHookName> = {
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

type HookState<H extends HookName> = {
  hooks: Array<Hooks[H]>;
};

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
function Hook<H extends ComponentHookName>({name, ...props}: Props<H>) {
  class HookComponent extends Component<Record<string, unknown>, HookState<H>> {
    static displayName = `Hook(${name})`;

    state = {
      hooks: HookStore.get(name).map((HookComp, index) => (
        <HookComp key={index} {...props} />
      )),
    };

    componentWillUnmount() {
      this.unsubscribe();
    }

    handleHooks(hookName: HookName, hooks: Array<Hooks[H]>) {
      // Make sure that the incoming hook update matches this component's hook name
      if (hookName !== name) {
        return;
      }

      this.setState({
        hooks: hooks.map((HookComp, index) => <HookComp key={index} {...props} />),
      });
    }

    unsubscribe = HookStore.listen(
      (hookName: HookName, hooks: Array<Hooks[H]>) => this.handleHooks(hookName, hooks),
      undefined
    );

    render() {
      const {children} = props;

      if (!this.state.hooks?.length) {
        return null;
      }

      if (typeof children === 'function') {
        return children({hooks: this.state.hooks});
      }

      return this.state.hooks;
    }
  }

  return <HookComponent />;
}

export default memo(Hook) as <H extends ComponentHookName>(
  props: Props<H>
) => React.ReactNode;
