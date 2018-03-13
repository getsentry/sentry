import PropTypes from 'prop-types';
import React from 'react';
import {Link as RouterLink} from 'react-router';

/**
 * A context-aware version of Link (from react-router) that falls
 * back to <a> if there is no router present.
 */
class Link extends React.Component {
  static propTypes = {
    to: PropTypes.string.isRequired,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  render() {
    if (this.context.location) {
      return <RouterLink {...this.props}>{this.props.children}</RouterLink>;
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

export default Link;
