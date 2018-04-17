import PropTypes from 'prop-types';
import React from 'react';
import {Link as RouterLink} from 'react-router';

/**
 * A context-aware version of Link (from react-router) that falls
 * back to <a> if there is no router present OR if you use `href`.
 */
class Link extends React.Component {
  static propTypes = {
    to: PropTypes.string,
    href: PropTypes.string,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  render() {
    let {to, href, ...props} = this.props;

    if (this.context.location && to) {
      return <RouterLink {...this.props} />;
    } else {
      return <a {...props} href={to || href} />;
    }
  }
}

export default Link;
