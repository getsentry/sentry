import React from 'react';
import {Link as RouterLink} from 'react-router';
import _ from 'lodash';

/**
 * A context-aware version of Link (from react-router) that falls
 * back to <a> if there is no router present.
 */
const Link = React.createClass({
  propTypes: {
    to: React.PropTypes.string.isRequired
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  render() {
    if (this.context.location) {
      return (
        <RouterLink {...this.props}>
          {this.props.children}
        </RouterLink>
      );
    } else {
      let props = {..._.omit(this.props, 'to'), href: this.props.to};
      return (
        <a {...props}>
          {this.props.children}
        </a>
      );
    }
  }
});

export default Link;
