import PropTypes from 'prop-types';
import React from 'react';
import {Link as RouterLink} from 'react-router';

/**
 * A modified link used for navigating between project pages that
 * will keep the environment in the querystring when navigating if it's present
 *
 * Falls back to <a> if there is no router present.
 */
class ProjectLink extends React.Component {
  static propTypes = {
    to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  render() {
    const {location} = this.context;

    if (location) {
      const hasEnvironment = 'environment' in location.query;

      let {to} = this.props;

      if (hasEnvironment) {
        if (typeof to === 'string') {
          to = {pathname: to, query: {environment: location.query.environment}};
        } else {
          to.query = {...to.query, environment: location.query.environment};
        }
      }

      const routerProps = to ? {...this.props, to} : {...this.props};

      return <RouterLink {...routerProps}>{this.props.children}</RouterLink>;
    } else {
      let {to, ...props} = this.props;
      return (
        <a {...props} href={to}>
          {this.props.children}
        </a>
      );
    }
  }
}

export default ProjectLink;
