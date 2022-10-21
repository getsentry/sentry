import {useCallback, useMemo} from 'react';
import Fuse from 'fuse.js';

export function useFuseSearch<T extends Record<string, unknown>>(
  data: T[],
  options: Fuse.IFuseOptions<T>
) {
  const searchIndex = useMemo(() => {
    return new Fuse(data, options);
  }, [data, options]);

  const search = useCallback(
    (...args: Parameters<Fuse<T>['search']>) => {
      const [pattern, opts] = args;
      if (!pattern) {
        return data;
      }
      return searchIndex.search(pattern, opts).map(result => result.item);
    },
    [searchIndex, data]
  );

  return {search, searchIndex};
}
