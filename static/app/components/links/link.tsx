import * as React from 'react';
import {Link as RouterLink, withRouter, WithRouterProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location, LocationDescriptor} from 'history';

type AnchorProps = React.HTMLProps<HTMLAnchorElement>;

type ToLocationFunction = (location: Location) => LocationDescriptor;

type Props = WithRouterProps & {
  // URL
  to: ToLocationFunction | LocationDescriptor;
  // Styles applied to the component's root
  className?: string;
} & Omit<AnchorProps, 'href' | 'target' | 'as' | 'css'>;

/**
 * A context-aware version of Link (from react-router) that falls
 * back to <a> if there is no router present
 */
class Link extends React.Component<Props> {
  componentDidMount() {
    const isRouterPresent = this.props.location;
    if (!isRouterPresent) {
      Sentry.captureException(
        new Error('The link component was rendered without being wrapped by a <Router />')
      );
    }
  }

  render() {
    const {disabled, to, ref, location, ...props} = this.props;

    if (!disabled && location) {
      return <RouterLink to={to} ref={ref as any} {...props} />;
    }

    if (typeof to === 'string') {
      return <Anchor href={to} ref={ref} disabled={disabled} {...props} />;
    }

    return <Anchor href="" ref={ref} {...props} disabled />;
  }
}

export default withRouter(Link);

const Anchor = styled('a', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && prop !== 'disabled',
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
