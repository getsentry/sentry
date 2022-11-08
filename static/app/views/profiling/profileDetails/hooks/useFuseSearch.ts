import {useCallback, useMemo} from 'react';
import Fuse from 'fuse.js';

type FuseSearchParams<T> = Parameters<Fuse<T>['search']>;
export function useFuseSearch<T extends Record<string, unknown>>(
  data: T[],
  options: Fuse.IFuseOptions<T>
) {
  const searchIndex = useMemo(() => {
    return new Fuse(data, options);
    // purposely ignoring options as it will cause the effect to infinitely run
    // data is sufficient as the index should only change if data ever changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const search = useCallback(
    (pattern: FuseSearchParams<T>[0] | undefined, opts?: FuseSearchParams<T>[1]) => {
      if (!pattern) {
        return data;
      }
      return searchIndex.search(pattern, opts).map(result => result.item);
    },
    [searchIndex, data]
  );

  return {search, searchIndex};
}
