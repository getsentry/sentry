import {flatten} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {loadSearchMap} from '../../../actionCreators/formSearch';
import ApiSource from './apiSource';
import FormSource from './formSource';
import RouteSource from './routeSource';

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

  render() {
    let {children, ...props} = this.props;

    return (
      <ApiSource {...props}>
        {apiArgs => (
          <FormSource {...props}>
            {formFieldArgs => (
              <RouteSource {...props}>
                {routeArgs => {
                  let allArgs = [apiArgs, formFieldArgs, routeArgs];
                  // loading means if any result has `isLoading` OR any result is null
                  let isLoading = !!allArgs.find(
                    arg => arg.isLoading || arg.results === null
                  );

                  // Only use first `MAX_RESULTS` after sorting by score
                  let foundResults =
                    (!isLoading &&
                      flatten(allArgs.map(({results}) => results || [])).sort(
                        (a, b) => a.score - b.score
                      )) ||
                    [];
                  let hasAnyResults = !!foundResults.length;

                  return children({
                    isLoading,
                    results: foundResults,
                    hasAnyResults,
                  });
                }}
              </RouteSource>
            )}
          </FormSource>
        )}
      </ApiSource>
    );
  }
}

export default SearchSources;
