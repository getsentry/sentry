import {flattenDepth} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {createFuzzySearch} from '../../utils/createFuzzySearch';
import accountSettingsNavigation from '../../views/settings/account/navigationConfiguration';
import organizationSettingsNavigation from '../../views/settings/organization/navigationConfiguration';
import projectSettingsNavigation from '../../views/settings/project/navigationConfiguration';
import replaceRouterParams from '../../utils/replaceRouterParams';

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

class RouteSearch extends React.Component {
  static propTypes = {
    searchMap: PropTypes.array,

    query: PropTypes.string,
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

export default RouteSearch;
