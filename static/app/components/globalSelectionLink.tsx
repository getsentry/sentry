import {withRouter, WithRouterProps} from 'react-router';
import {LocationDescriptor} from 'history';
import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';

type Props = WithRouterProps & {
  /**
   * Location that is being linked to
   */
  to: LocationDescriptor;
  children?: React.ReactNode;
  /**
   * Styles applied to the component's root
   */
  className?: string;
  /**
   * Click event (not for navigation)
   */
  onClick?: React.ComponentProps<typeof Link>['onClick'];
  /**
   * Inline styles
   */
  style?: React.CSSProperties;
};

/**
 * A modified link used for navigating between organization level pages that
 * will keep the global selection values (projects, environments, time) in the
 * querystring when navigating if it's present
 *
 * Falls back to <a> if there is no router present.
 */
function GlobalSelectionLink(props: Props) {
  const {location, to} = props;

  const globalQuery = extractSelectionParameters(location?.query);
  const hasGlobalQuery = Object.keys(globalQuery).length > 0;
  const query =
    typeof to === 'object' && to.query ? {...globalQuery, ...to.query} : globalQuery;

  if (location) {
    const toWithGlobalQuery: LocationDescriptor = !hasGlobalQuery
      ? {}
      : typeof to === 'string'
      ? {pathname: to, query}
      : {...to, query};

    const routerProps = hasGlobalQuery
      ? {...props, to: toWithGlobalQuery}
      : {...props, to};

    return <Link {...routerProps} />;
  }

  let queryStringObject = {};
  if (typeof to === 'object' && to.search) {
    queryStringObject = qs.parse(to.search);
  }

  queryStringObject = {...queryStringObject, ...globalQuery};

  if (typeof to === 'object' && to.query) {
    queryStringObject = {...queryStringObject, ...to.query};
  }

  const queryString = qs.stringify(queryStringObject);
  const url =
    (typeof to === 'string' ? to : to.pathname) + (queryString ? `?${queryString}` : '');

  return <a {...props} href={url} />;
}

export default withRouter(GlobalSelectionLink);
