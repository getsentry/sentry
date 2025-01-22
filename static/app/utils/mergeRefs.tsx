/**
 * Combine refs to allow assignment to all passed refs
 */
export default function mergeRefs<T = any>(
  refs: (React.MutableRefObject<T> | React.LegacyRef<T> | undefined)[]
): React.RefCallback<T> {
  return value => {
    refs.forEach(ref => {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref !== null && ref !== undefined) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}
