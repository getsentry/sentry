import {useMemo} from 'react';
import {mergeRefs} from '@react-aria/utils';

/**
 * Returns a stable function for merging a dynamic child ref with a stable ref.
 *
 * Merged refs are cached by child ref identity so React does not detach and
 * reattach callback refs on every render. Cleanup functions returned by either
 * ref are preserved by `mergeRefs`.
 */
export function useStableMergeRef<T>(stableRef: React.Ref<T>) {
  return useMemo(() => {
    const cache = new WeakMap<NonNullable<React.Ref<T>>, React.Ref<T>>();

    return (ref: React.Ref<T> | null | undefined) => {
      if (ref === null || ref === undefined) {
        return stableRef;
      }

      const cachedRef = cache.get(ref);
      if (cachedRef !== undefined) {
        return cachedRef;
      }

      const mergedRef = mergeRefs(ref, stableRef);
      cache.set(ref, mergedRef);
      return mergedRef;
    };
  }, [stableRef]);
}
