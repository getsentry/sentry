import {Link as RouterLink} from 'react-router';
import styled from '@emotion/styled';
import classNames from 'classnames';
import {LocationDescriptor} from 'history';
import * as qs from 'query-string';

import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

type LinkProps = Omit<React.ComponentProps<typeof RouterLink>, 'to'>;

type Props = LinkProps & {
  /**
   * Link target. We don't want to expose the ToLocationFunction on this component.
   */
  to: LocationDescriptor;
  /**
   * The class to apply when the link is 'active'
   */
  activeClassName?: string;
  disabled?: boolean;
  index?: boolean;
  /**
   * Should be should be supplied by the parent component
   */
  isActive?: (location: LocationDescriptor, indexOnly?: boolean) => boolean;
  query?: string;
};

function ListLink({
  children,
  className,
  isActive,
  query,
  to,
  activeClassName = 'active',
  index = false,
  disabled = false,
  ...props
}: Props) {
  const router = useRouter();
  const queryData = query ? qs.parse(query) : undefined;
  const targetLocation = typeof to === 'string' ? {pathname: to, query: queryData} : to;
  const target = normalizeUrl(targetLocation);

  const active = isActive?.(target, index) ?? router.isActive(target, index);

  return (
    <StyledLi
      className={classNames({[activeClassName]: active}, className)}
      disabled={disabled}
    >
      <RouterLink {...props} onlyActiveOnIndex={index} to={disabled ? '' : target}>
        {children}
      </RouterLink>
    </StyledLi>
  );
}

export default ListLink;

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
