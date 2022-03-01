import * as React from 'react';
import flatten from 'lodash/flatten';

import {Fuse} from 'sentry/utils/fuzzySearch';

import {Result} from './types';

type ChildProps = {
  hasAnyResults: boolean;
  isLoading: boolean;
  results: Result[];
};

type Props = {
  children: (props: ChildProps) => React.ReactElement;
  params: {orgId: string};
  query: string;
  sources: React.ComponentType[];
  searchOptions?: Fuse.IFuseOptions<any>;
};

type SourceResult = {
  isLoading: boolean;
  results: Result[];
};

class SearchSources extends React.Component<Props> {
  // `allSources` will be an array of all result objects from each source
  renderResults(allSources: SourceResult[]) {
    const {children} = this.props;

    // loading means if any result has `isLoading` OR any result is null
    const isLoading = !!allSources.find(arg => arg.isLoading || arg.results === null);

    const foundResults = isLoading
      ? []
      : flatten(allSources.map(({results}) => results || [])).sort(
          (a, b) => (a.score ?? 0) - (b.score ?? 0)
        );
    const hasAnyResults = !!foundResults.length;

    return children({
      isLoading,
      results: foundResults,
      hasAnyResults,
    });
  }

  renderSources(sources: Props['sources'], results: SourceResult[], idx: number) {
    if (idx >= sources.length) {
      return this.renderResults(results);
    }
    const Source = sources[idx];
    return (
      <Source {...this.props}>
        {(args: SourceResult) => {
          // Mutate the array instead of pushing because we don't know how often
          // this child function will be called and pushing will cause duplicate
          // results to be pushed for all calls down the chain.
          results[idx] = args;
          return this.renderSources(sources, results, idx + 1);
        }}
      </Source>
    );
  }

  render() {
    return this.renderSources(
      this.props.sources,
      new Array(this.props.sources.length),
      0
    );
  }
}

export default SearchSources;
