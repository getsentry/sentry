import flattenDepth from 'lodash/flattenDepth';
import PropTypes from 'prop-types';
import React from 'react';

import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import SentryTypes from 'app/sentryTypes';
import accountSettingsNavigation from 'app/views/settings/account/navigationConfiguration';
import organizationSettingsNavigation from 'app/views/settings/organization/navigationConfiguration';
import projectSettingsNavigation from 'app/views/settings/project/navigationConfiguration';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import withLatestContext from 'app/utils/withLatestContext';

// navigation configuration can currently be either:
// * an array of {name: string, items: Array<{NavItem}>} OR
// * a function that returns the above
//   (some navigation items require additional context, e.g. a badge based on a `project` property)
//
// We need to go through all navigation configurations and get a flattened list of all navigation item objects
const mapFunc = (config, context = {}) =>
  (Array.isArray(config) ? config : config(context)).map(({items}) =>
    items.filter(({show}) => (typeof show === 'function' ? show(context) : true))
  );

class RouteSource extends React.Component {
  static propTypes = {
    // search term
    query: PropTypes.string,

    // fuse.js options
    searchOptions: PropTypes.object,

    // Array of routes to search
    searchMap: PropTypes.array,

    organization: SentryTypes.Organization,
    project: SentryTypes.Project,

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

  constructor(props) {
    super(props);

    this.state = {
      fuzzy: null,
    };

    this.createSearch();
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.project === this.props.project &&
      prevProps.organization === this.props.organization
    ) {
      return;
    }

    this.createSearch();
  }

  async createSearch() {
    const {project, organization} = this.props;
    const searchMap = flattenDepth(
      [
        mapFunc(accountSettingsNavigation),
        mapFunc(projectSettingsNavigation, {
          project: project || {},
          organization: organization || {},
          access: new Set((organization && organization.access) || []),
          features: new Set((project && project.features) || []),
        }),
        mapFunc(organizationSettingsNavigation, {
          organization: organization || {},
          access: new Set((organization && organization.access) || []),
          features: new Set((organization && organization.features) || []),
        }),
      ],
      2
    );
    this.setState({
      fuzzy: await createFuzzySearch(searchMap || [], {
        ...this.props.searchOptions,
        keys: ['title', 'description'],
      }),
    });
  }

  render() {
    const {searchMap, query, params, children} = this.props;

    const results =
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

export default withLatestContext(RouteSource);
export {RouteSource};
