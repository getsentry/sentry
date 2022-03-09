import {useEffect, useRef} from 'react';

/**
 * Provides previous prop or state inside of function components.
 * It’s possible that in the future React will provide a usePrevious Hook out of the box since it’s a relatively common use case.
 * @see {@link https://reactjs.org/docs/hooks-faq.html#how-to-get-the-previous-props-or-state}
 *
 * @returns 'ref.current' and therefore should not be used as a dependency of useEffect.
 * Mutable values like 'ref.current' are not valid dependencies of useEffect because changing them does not re-render the component.
 */
function usePrevious<T>(value: T): T {
  // The ref object is a generic container whose current property is mutable ...
  // ... and can hold any value, similar to an instance property on a class
  const ref = useRef<T>(value);
  // Store current value in ref
  useEffect(() => {
    ref.current = value;
  }, [value]); // Only re-run if value changes
  // Return previous value (happens before update in useEffect above)
  return ref.current;
}

export default usePrevious;
