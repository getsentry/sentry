import PropTypes from 'prop-types';
import React from 'react';
import {Link as RouterLink} from 'react-router';

import {extractSelectionParameters} from 'app/components/organizations/globalSelectionHeader/utils';

/**
 * A modified link used for navigating between organization level pages that
 * will keep the global selection values (projects, environments, time) in the
 * querystring when navigating if it's present
 *
 * Falls back to <a> if there is no router present.
 */
export default class GlobalSelectionLink extends React.Component {
  static propTypes = {
    to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  render() {
    const {location} = this.context;
    const {to} = this.props;

    const globalQuery = extractSelectionParameters(location.query);
    const hasGlobalQuery = Object.keys(globalQuery).length > 0;
    const query = to && to.query ? {...globalQuery, ...to.query} : globalQuery;

    if (location) {
      let toWithGlobalQuery;
      if (hasGlobalQuery) {
        if (typeof to === 'string') {
          toWithGlobalQuery = {pathname: to, query};
        } else {
          toWithGlobalQuery = {...to, query};
        }
      }
      const routerProps = toWithGlobalQuery
        ? {...this.props, to: toWithGlobalQuery}
        : {...this.props, to};

      return <RouterLink {...routerProps}>{this.props.children}</RouterLink>;
    } else {
      return (
        <a {...this.props} href={to}>
          {this.props.children}
        </a>
      );
    }
  }
}
