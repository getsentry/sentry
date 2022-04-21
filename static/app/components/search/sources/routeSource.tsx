import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import flattenDepth from 'lodash/flattenDepth';

import {Organization, Project} from 'sentry/types';
import {createFuzzySearch, Fuse} from 'sentry/utils/fuzzySearch';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import withLatestContext from 'sentry/utils/withLatestContext';
import accountSettingsNavigation from 'sentry/views/settings/account/navigationConfiguration';
import organizationSettingsNavigation from 'sentry/views/settings/organization/navigationConfiguration';
import projectSettingsNavigation from 'sentry/views/settings/project/navigationConfiguration';
import {NavigationItem} from 'sentry/views/settings/types';

import {ChildProps, ResultItem} from './types';
import {strGetFn} from './utils';

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
  (Array.isArray(config) ? config : context !== null ? config(context) : []).map(
    ({items}) =>
      items.filter(({show}) =>
        typeof show === 'function' && context !== null ? show(context) : true
      )
  );

type DefaultProps = {
  /**
   * Fuse configuration for searching NavigationItem's
   */
  searchOptions: Fuse.IFuseOptions<NavigationItem>;
};

type Props = RouteComponentProps<{}, {}> &
  DefaultProps & {
    /**
     * Render function that renders the route matches
     */
    children: (props: ChildProps) => React.ReactNode;
    /**
     * The string to search the navigation routes for
     */
    query: string;
    organization?: Organization;
    project?: Project;
  };

type State = {
  /**
   * A Fuse instance configured to search NavigationItem's
   */
  fuzzy: undefined | null | Fuse<NavigationItem>;
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
        mapFunc(accountSettingsNavigation, context),
        mapFunc(projectSettingsNavigation, context),
        mapFunc(organizationSettingsNavigation, context),
      ],
      2
    );

    const options = {
      ...this.props.searchOptions,
      keys: ['title', 'description'],
      getFn: strGetFn,
    };

    const fuzzy = await createFuzzySearch(searchMap ?? [], options);
    this.setState({fuzzy});
  }

  render() {
    const {query, params, children} = this.props;
    const {fuzzy} = this.state;

    const results =
      fuzzy?.search(query).map(({item, ...rest}) => ({
        item: {
          ...item,
          sourceType: 'route',
          resultType: 'route',
          to: replaceRouterParams(item.path, params),
        } as ResultItem,
        ...rest,
      })) ?? [];

    return children({
      isLoading: this.state.fuzzy === undefined,
      results,
    });
  }
}

export default withLatestContext(RouteSource);
export {RouteSource};
