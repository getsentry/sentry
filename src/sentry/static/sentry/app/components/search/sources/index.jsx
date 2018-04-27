import {flatten} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {loadSearchMap} from 'app/actionCreators/formSearch';
import ApiSource from 'app/components/search/sources/apiSource';
import FormSource from 'app/components/search/sources/formSource';
import RouteSource from 'app/components/search/sources/routeSource';

class SearchSources extends React.Component {
  static propTypes = {
    query: PropTypes.string,
    /**
     * Render function the passes:
     *
     * `isLoading`
     * `results` - Array of results
     * `hasAnyResults` - if any results were found
     */
    children: PropTypes.func,
  };

  componentDidMount() {
    // Loads form fields
    loadSearchMap();
  }

  // `allSources` will be an array of all result objects from each source
  renderResults(...allSources) {
    let {children} = this.props;

    // loading means if any result has `isLoading` OR any result is null
    let isLoading = !!allSources.find(arg => arg.isLoading || arg.results === null);

    let foundResults = isLoading
      ? []
      : flatten(allSources.map(({results}) => results || [])).sort(
          (a, b) => a.score - b.score
        );
    let hasAnyResults = !!foundResults.length;

    return children({
      isLoading,
      results: foundResults,
      hasAnyResults,
    });
  }

  render() {
    return (
      <ApiSource {...this.props}>
        {apiArgs => (
          <FormSource {...this.props}>
            {formFieldArgs => (
              <RouteSource {...this.props}>
                {routeArgs => this.renderResults(apiArgs, formFieldArgs, routeArgs)}
              </RouteSource>
            )}
          </FormSource>
        )}
      </ApiSource>
    );
  }
}

export default SearchSources;
