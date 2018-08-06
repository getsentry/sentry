import {flattenDepth} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import accountSettingsNavigation from 'app/views/settings/account/navigationConfiguration';
import organizationSettingsNavigation from 'app/views/settings/organization/navigationConfiguration';
import projectSettingsNavigation from 'app/views/settings/project/navigationConfiguration';
import replaceRouterParams from 'app/utils/replaceRouterParams';

// navigation configuration can currently be either:
// * an array of {name: string, items: Array<{NavItem}>} OR
// * a function that returns the above
//   (some navigation items require additional context, e.g. a badge based on a `project` property)
//
// We need to go through all navigation configurations and get a flattened list of all navigation item objects
const navigationItems = flattenDepth(
  [
    accountSettingsNavigation,
    projectSettingsNavigation,
    organizationSettingsNavigation,
  ].map(config =>
    (Array.isArray(config) ? config : config({project: {}})).map(({items}) => items)
  ),
  2
);

class RouteSource extends React.Component {
  static propTypes = {
    // search term
    query: PropTypes.string,

    // fuse.js options
    searchOptions: PropTypes.object,

    // Array of routes to search
    searchMap: PropTypes.array,

    /**
     * Render function that passes:
     * `isLoading` - loading state
     * `allResults` - All results returned from all queries: [searchIndex, model, type]
     * `results` - Results array filtered by `this.props.query`: [searchIndex, model, type]
     */
    children: PropTypes.func.isRequired,
  };

  static defaultProps = {
    searchMap: [],
    searchOptions: {},
  };

  constructor(...args) {
    super(...args);

    this.state = {
      fuzzy: null,
    };

    this.createSearch(navigationItems);
  }

  async createSearch(searchMap) {
    this.setState({
      fuzzy: await createFuzzySearch(searchMap || [], {
        ...this.props.searchOptions,
        keys: ['title', 'description'],
      }),
    });
  }

  render() {
    let {searchMap, query, params, children} = this.props;

    let results =
      (this.state.fuzzy &&
        this.state.fuzzy.search(query).map(({item, ...rest}) => ({
          item: {
            ...item,
            sourceType: 'route',
            resultType: 'route',
            to: `${replaceRouterParams(item.path, params)}`,
          },
          ...rest,
        }))) ||
      [];

    return children({
      isLoading: searchMap === null,
      allResults: searchMap,
      results,
    });
  }
}

export default RouteSource;
