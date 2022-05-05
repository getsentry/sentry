import {Component} from 'react';
import {Link as RouterLink, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import classNames from 'classnames';
import {LocationDescriptor} from 'history';
import omit from 'lodash/omit';
import * as qs from 'query-string';

type DefaultProps = {
  activeClassName: string;
  disabled: boolean;
  index: boolean;
};

type LinkProps = Omit<React.ComponentProps<typeof RouterLink>, 'to'>;

type Props = WithRouterProps &
  Partial<DefaultProps> &
  LinkProps & {
    /**
     * Link target. We don't want to expose the ToLocationFunction on this component.
     */
    to: LocationDescriptor;
    // If supplied by parent component, decides whether link element
    // is "active" or not ... overriding default behavior of strict
    // route matching
    isActive?: (location: LocationDescriptor, indexOnly?: boolean) => boolean;
    query?: string;
  };

class ListLink extends Component<Props> {
  static displayName = 'ListLink';

  static defaultProps: DefaultProps = {
    activeClassName: 'active',
    index: false,
    disabled: false,
  };

  isActive() {
    const {isActive, to, query, index, router} = this.props;
    const queryData = query ? qs.parse(query) : undefined;
    const target: LocationDescriptor =
      typeof to === 'string' ? {pathname: to, query: queryData} : to;

    if (typeof isActive === 'function') {
      return isActive(target, index);
    }

    return router.isActive(target, index);
  }

  getClassName = () => {
    const _classNames = {};
    const {className, activeClassName} = this.props;

    if (className) {
      _classNames[className] = true;
    }

    if (this.isActive() && activeClassName) {
      _classNames[activeClassName] = true;
    }

    return classNames(_classNames);
  };

  render() {
    const {index, children, to, disabled, ...props} = this.props;
    const carriedProps = omit(
      props,
      'activeClassName',
      'css',
      'isActive',
      'index',
      'router',
      'location'
    );

    return (
      <StyledLi className={this.getClassName()} disabled={disabled}>
        <RouterLink {...carriedProps} onlyActiveOnIndex={index} to={disabled ? '' : to}>
          {children}
        </RouterLink>
      </StyledLi>
    );
  }
}

export default withRouter(ListLink);

const StyledLi = styled('li', {
  shouldForwardProp: prop => prop !== 'disabled',
})<{disabled?: boolean}>`
  ${p =>
    p.disabled &&
    `
   a {
    color:${p.theme.disabled} !important;
    pointer-events: none;
    :hover {
      color: ${p.theme.disabled}  !important;
    }
   }
`}
`;
