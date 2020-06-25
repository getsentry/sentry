import React from 'react';
import PropTypes from 'prop-types';
import {Link as RouterLink} from 'react-router';
import {Location, LocationDescriptor} from 'history';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';
import * as Sentry from '@sentry/react';

type AnchorProps = React.HTMLProps<HTMLAnchorElement>;

type ToLocationFunction = (location: Location) => LocationDescriptor;

type Props = {
  //URL
  to: string | ToLocationFunction | LocationDescriptor;
  // Styles applied to the component's root
  className?: string;
} & Omit<AnchorProps, 'href' | 'target'>;

/**
 * A context-aware version of Link (from react-router) that falls
 * back to <a> if there is no router present
 */
class Link extends React.Component<Props> {
  static contextTypes = {
    location: PropTypes.object,
  };

  componentDidMount() {
    const isRouterPresent = this.context.location;
    if (!isRouterPresent) {
      Sentry.captureException(
        new Error('The link component was rendered without being wrapped by a <Router />')
      );
    }
  }

  render() {
    const {to, ref, ...props} = this.props;
    const isRouterPresent = this.context.location;

    if (isRouterPresent) {
      return <RouterLink to={to} ref={ref as any} {...props} />;
    }

    if (typeof to === 'string') {
      return <Anchor href={to} ref={ref} {...props} />;
    }

    return <Anchor href="" ref={ref} {...props} disabled />;
  }
}

export default Link;

const Anchor = styled('a', {
  shouldForwardProp: prop => isPropValid(prop) && prop !== 'disabled',
})<{disabled?: boolean}>`
  ${p =>
    p.disabled &&
    `
  color:${p.theme.disabled};
  pointer-events: none;
  :hover {
    color: ${p.theme.disabled};
  }
  `};
`;
