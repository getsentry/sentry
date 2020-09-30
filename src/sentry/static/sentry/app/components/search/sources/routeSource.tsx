import flattenDepth from 'lodash/flattenDepth';
import React from 'react';
import {FuseOptions, FuseResultWithMatches} from 'fuse.js';
import {WithRouterProps} from 'react-router';

import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import accountSettingsNavigation from 'app/views/settings/account/navigationConfiguration';
import organizationSettingsNavigation from 'app/views/settings/organization/navigationConfiguration';
import projectSettingsNavigation from 'app/views/settings/project/navigationConfiguration';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import withLatestContext from 'app/utils/withLatestContext';
import {NavigationItem} from 'app/views/settings/types';
import {Organization, Project} from 'app/types';

type Config =
  | typeof accountSettingsNavigation
  | typeof organizationSettingsNavigation
  | typeof projectSettingsNavigation;

// XXX(epurkhiser): We use the context in mapFunc to handle both producing the
// NavigationSection list AND filtering out items in the sections that should
// not be shown using the `show` attribute of the NavigationItem
type Context = Parameters<Extract<Config, Function>>[0] &
  Parameters<Extract<NavigationItem['show'], Function>>[0];

/**
 * navigation configuration can currently be either:
 *
 *  - an array of {name: string, items: Array<{NavItem}>} OR
 *  - a function that returns the above
 *    (some navigation items require additional context, e.g. a badge based on
 *    a `project` property)
 *
 * We need to go through all navigation configurations and get a flattened list
 * of all navigation item objects
 */
const mapFunc = (config: Config, context: Context | null = null) =>
  (Array.isArray(config)
    ? config
    : context !== null
    ? config(context)
    : []
  ).map(({items}) =>
    items.filter(({show}) =>
      typeof show === 'function' && context !== null ? show(context) : true
    )
  );

type ItemProps = {
  resultType: 'route';
  sourceType: 'route';
  to: string;
};

type Result = {
  item: NavigationItem & ItemProps;
  matches: FuseResultWithMatches<NavigationItem>['matches'];
  score: number;
};

type RenderProps = {
  isLoading: boolean;
  /**
   * Unused in this source
   */
  allResults: object[];
  /**
   * Matched results
   */
  results: Result[];
};

type DefaultProps = {
  /**
   * Fuse configuration for searching NavigationItem's
   */
  searchOptions: FuseOptions<NavigationItem>;
};

type Props = WithRouterProps &
  DefaultProps & {
    organization?: Organization;
    project?: Project;
    /**
     * The string to search the navigation routes for
     */
    query: string;
    /**
     * Render function that renders the route matches
     */
    children: (props: RenderProps) => React.ReactNode;
  };

type State = {
  /**
   * A Fuse instance configured to search NavigationItem's
   */
  fuzzy: undefined | null | Fuse<NavigationItem, FuseOptions<NavigationItem>>;
};

class RouteSource extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    searchOptions: {},
  };

  state: State = {
    fuzzy: undefined,
  };

  componentDidMount() {
    this.createSearch();
  }

  componentDidUpdate(prevProps: Props) {
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

    const context = {
      project,
      organization,
      access: new Set(organization?.access ?? []),
      features: new Set(project?.features ?? []),
    } as Context;

    const searchMap = flattenDepth<NavigationItem>(
      [
        mapFunc(accountSettingsNavigation),
        mapFunc(projectSettingsNavigation, context),
        mapFunc(organizationSettingsNavigation, context),
      ],
      2
    );

    const options = {
      ...this.props.searchOptions,
      keys: ['title', 'description'],
    };

    const fuzzy = await createFuzzySearch<NavigationItem>(searchMap ?? [], options);
    this.setState({fuzzy});
  }

  render() {
    const {query, params, children} = this.props;

    const results =
      this.state.fuzzy?.search<NavigationItem, true, true>(query).map(
        ({item, ...rest}) =>
          ({
            item: {
              ...item,
              sourceType: 'route',
              resultType: 'route',
              to: replaceRouterParams(item.path, params),
            },
            ...rest,
          } as Result)
      ) ?? [];

    return children({
      isLoading: this.state.fuzzy === undefined,
      allResults: [],
      results,
    });
  }
}

export default withLatestContext(RouteSource);
export {RouteSource};
