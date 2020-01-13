import React from 'react';
import PropTypes from 'prop-types';
import {Link as RouterLink} from 'react-router';
import {LocationDescriptor} from 'history';

type PropsWithHref = {href: string};
type PropsWithTo = {to: LocationDescriptor};
type Props = PropsWithTo | PropsWithHref;

/**
 * A context-aware version of Link (from react-router) that falls
 * back to <a> if there is no router present OR if you use `href`.
 */
class Link extends React.Component<Props> {
  static propTypes = {
    to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    href: PropTypes.string,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  render() {
    const {props} = this;

    if (this.context.location && 'to' in props && props.to) {
      return <RouterLink to={props.to} {...props} />;
    } else if ('href' in props && props.href) {
      return <a href={props.href} {...props} />;
    } else {
      return <a {...props} />;
    }
  }
}

export default Link;
