import React from 'react';

interface SlotProps extends React.ComponentProps<any> {
  children?: React.ReactNode;
}

/**
 * The slot Component is used internally inside the design system to implement the asChild slot pattern.
 * @internal
 */
export function Slot({children, ...props}: SlotProps): React.ReactNode {
  // Destructure child, or else we'll just end up rendering it as the child prop
  // and negate the entire slot functionality.
  if (React.isValidElement(children)) {
    return React.cloneElement(children, mergePropsWithStyles(props, children.props));
  }

  // React.Children.only will throw if there are multiple children.
  return process.env.NODE_ENV === 'production' ? null : React.Children.only(children);
}

function mergePropsWithStyles(
  slotProps: SlotProps,
  childProps: React.ComponentProps<any>
) {
  // take all children props and merge them with the slot props
  const result = {...childProps};

  for (const slotPropKey in slotProps) {
    const slotValue = slotProps[slotPropKey];

    // If child doesn't have this prop, just add the slot prop
    if (childProps[slotPropKey] === undefined) {
      result[slotPropKey] = slotValue;
      continue;
    }

    const childValue = childProps[slotPropKey];

    if (typeof childValue === 'function' && typeof slotValue === 'function') {
      result[slotPropKey] = (...args: readonly unknown[]) => {
        // Call the slot function as a side effect of the child invocation and treat the result as the return value.

        // There is a potential issue here where it is currently possible for the child function
        // to mutate args, causing the slot to receive different arguments than the ones passed in.
        // I am unsure if this could be mitigated, as it would require a deep clone of args,
        // which might not be feasible due to unserializable values.
        const value = childValue(...args);
        slotValue(...args);
        return value;
      };
      continue;
    }

    switch (slotPropKey) {
      case 'style':
        // Treat the styles from the slot as more of a suggestion than a strict override,
        // which allows users to opt out of the style override by omitting the child style implementation.
        result[slotPropKey] = {
          ...slotValue,
          ...childValue,
        };
        break;
      case 'className':
        result[slotPropKey] = [childValue, slotValue].filter(Boolean).join(' ');
        break;
      default:
        // Slot props take precedence over child props.
        result[slotPropKey] = slotValue;
        break;
    }
  }

  return result;
}
