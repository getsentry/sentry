import {type ComponentType} from 'react';

import {getOverride} from 'sentry/overrideRegistry';
import type {OverrideName, Overrides} from 'sentry/types/overrides';

// Only allow overrides that return a React component
type ComponentOverrideName = {
  [K in OverrideName]: Overrides[K] extends ComponentType<any> ? K : never;
}[OverrideName];

type Props<H extends ComponentOverrideName> = {
  /**
   * The name of the override as listed in overrideRegistry.registerOverride(overrideName, callback)
   */
  name: H;
  /**
   * If children are provided as a function to the Override, the rendered override
   * will be passed down as a render prop.
   */
  children?: (opts: {rendered: React.ReactNode}) => React.ReactNode;
} & Omit<Parameters<Overrides[H]>[0], 'name'>;

/**
 * Instead of accessing the override registry directly, use this.
 *
 * If the override slot needs to perform anything w/ the override, you can pass a
 * function as a child and you will receive an object with a `rendered` key.
 *
 * Example:
 *
 *   <Override name="my-override">
 *     {({rendered}) => <Wrapper>{rendered}</Wrapper>}
 *   </Override>
 */
export function Override<H extends ComponentOverrideName>({
  name,
  children,
  ...props
}: Props<H>) {
  const override = getOverride(name);

  if (!override) {
    return null;
  }

  const OverrideComp = override as React.ComponentType<any>;
  const rendered = <OverrideComp {...props} />;

  if (typeof children === 'function') {
    return children({rendered});
  }

  return rendered;
}
