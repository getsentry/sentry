import {memo, type ComponentType} from 'react';

import {getHook} from 'sentry/hookRegistry';
import type {HookName, Hooks} from 'sentry/types/hooks';

// Only allow hooks that return a React component
type ComponentHookName = {
  [K in HookName]: Hooks[K] extends ComponentType<any> ? K : never;
}[HookName];

type Props<H extends ComponentHookName> = {
  /**
   * The name of the hook as listed in hookRegistry.registerHook(hookName, callback)
   */
  name: H;
  /**
   * If children are provided as a function to the Hook, the rendered hook
   * will be passed down as a render prop.
   */
  children?: (opts: {rendered: React.ReactNode}) => React.ReactNode;
} & Omit<Parameters<Hooks[H]>[0], 'name'>;

/**
 * Instead of accessing the hook registry directly, use this.
 *
 * If the hook slot needs to perform anything w/ the hook, you can pass a
 * function as a child and you will receive an object with a `rendered` key.
 *
 * Example:
 *
 *   <Hook name="my-hook">
 *     {({rendered}) => <Wrapper>{rendered}</Wrapper>}
 *   </Hook>
 */
function Hook<H extends ComponentHookName>({name, children, ...props}: Props<H>) {
  const hookCallback = getHook(name);

  if (!hookCallback) {
    return null;
  }

  const HookComp = hookCallback as React.ComponentType<any>;
  const rendered = <HookComp {...props} />;

  if (typeof children === 'function') {
    return children({rendered});
  }

  return rendered;
}

export default memo(Hook) as <H extends ComponentHookName>(
  props: Props<H>
) => React.ReactNode;
