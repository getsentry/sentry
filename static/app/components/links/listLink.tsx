import {Link as RouterLink} from 'react-router';
import styled from '@emotion/styled';
import classNames from 'classnames';
import type {LocationDescriptor} from 'history';

import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useRouter from 'sentry/utils/useRouter';

type LinkProps = Omit<React.ComponentProps<typeof RouterLink>, 'to'>;

type Props = LinkProps & {
  /**
   * Link target. We don't want to expose the ToLocationFunction on this component.
   */
  to: LocationDescriptor;
  disabled?: boolean;
  index?: boolean;
  /**
   * Should be should be supplied by the parent component
   */
  isActive?: (location: LocationDescriptor, indexOnly?: boolean) => boolean;
};

function ListLink({
  children,
  className,
  isActive,
  to,
  index = false,
  disabled = false,
  ...props
}: Props) {
  const router = useRouter();
  const targetLocation = typeof to === 'string' ? {pathname: to} : to;
  const target = normalizeUrl(targetLocation);

  const active = isActive?.(target, index) ?? router.isActive(target, index);

  return (
    <StyledLi className={classNames({active}, className)} disabled={disabled}>
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
      :hover {
        color: ${p.theme.disabled}  !important;
      }
      cursor: default !important;
    }

  a:active {
    pointer-events: none;
  }
`}
`;
