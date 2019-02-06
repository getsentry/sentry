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

    const query = extractSelectionParameters(location.query);

    if (location) {
      const hasQuery = Object.keys(query).length > 0;

      let {to} = this.props;

      if (hasQuery) {
        if (typeof to === 'string') {
          to = {pathname: to, query};
        }
      }

      const routerProps = to ? {...this.props, to} : {...this.props};

      return <RouterLink {...routerProps}>{this.props.children}</RouterLink>;
    } else {
      const {to, ...props} = this.props;
      return (
        <a {...props} href={to}>
          {this.props.children}
        </a>
      );
    }
  }
}
