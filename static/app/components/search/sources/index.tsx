import {useCallback} from 'react';
import sortBy from 'lodash/sortBy';

import type {Fuse} from 'sentry/utils/fuzzySearch';

import type {Result} from './types';

type ChildProps = {
  allLoaded: boolean;
  results: Result[];
};

type Props = {
  children: (props: ChildProps) => React.ReactElement;
  params: {orgId: string};
  query: string;
  sources: Array<React.ComponentType<any>>;
  searchOptions?: Fuse.IFuseOptions<any>;
};

type SourceResult = {
  isLoading: boolean;
  results: Result[];
};

function SearchSources(props: Props) {
  const {children, sources} = props;

  // `allSources` will be an array of all result objects from each source
  const renderResults = useCallback(
    (allSources: SourceResult[]) => {
      const allLoaded = allSources.every(source => !source.isLoading);
      const results = sortBy(
        allSources.flatMap(item => item.results ?? []),
        ['item.resolvedTs', 'score']
      );

      return children({allLoaded, results});
    },
    [children]
  );

  const renderSources = useCallback(
    (results: SourceResult[], idx: number) => {
      if (idx >= sources.length) {
        return renderResults(results);
      }
      const Source = sources[idx]!;
      return (
        <Source {...props}>
          {(args: SourceResult) => {
            // Mutate the array instead of pushing because we don't know how often
            // this child function will be called and pushing will cause duplicate
            // results to be pushed for all calls down the chain.
            results[idx] = args;
            return renderSources(results, idx + 1);
          }}
        </Source>
      );
    },
    [props, renderResults, sources]
  );

  return renderSources(new Array(sources.length), 0);
}

export default SearchSources;
