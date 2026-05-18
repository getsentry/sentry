import {memo, useEffect, useState, type ComponentType} from 'react';

import {HookStore} from 'sentry/stores/hookStore';
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
function Hook<H extends ComponentHookName>({name, children, ...props}: Props<H>) {
  const [hookCallbacks, setHookCallbacks] = useState<Array<Hooks[H]>>(() =>
    HookStore.get(name)
  );

  useEffect(() => {
    setHookCallbacks([...HookStore.get(name)]);

    const unsubscribe = HookStore.listen((hookName: HookName, hooks: Array<Hooks[H]>) => {
      if (hookName === name) {
        setHookCallbacks([...hooks]);
      }
    }, undefined);
    return () => unsubscribe();
  }, [name]);

  if (!hookCallbacks?.length) {
    return null;
  }

  const rendered = hookCallbacks.map((HookComp, index) => (
    <HookComp key={index} {...props} />
  ));

  if (typeof children === 'function') {
    return children({hooks: rendered});
  }

  return rendered;
}

export default memo(Hook) as <H extends ComponentHookName>(
  props: Props<H>
) => React.ReactNode;
