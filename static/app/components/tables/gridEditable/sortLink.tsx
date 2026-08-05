import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';

import {Link} from '@sentry/scraps/link';

import type {ColumnAlign} from 'sentry/components/tables/gridEditable';
import type {SortDirection} from 'sentry/components/tables/sortableHeaderCell';
import {IconArrow} from 'sentry/icons';
import {useNavigate} from 'sentry/utils/useNavigate';

type Props = {
  align: ColumnAlign;
  canSort: boolean;
  direction: SortDirection | undefined;
  title: React.ReactNode;
  generateSortLink?: () => LocationDescriptorObject | undefined;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  preventScrollReset?: boolean;
  replace?: boolean;
};

export function SortLink({
  align,
  title,
  canSort,
  generateSortLink,
  onClick,
  direction,
  replace,
  preventScrollReset,
}: Props) {
  const target = generateSortLink?.();
  const navigate = useNavigate();

  if (!target || !canSort) {
    return <StyledNonLink align={align}>{title}</StyledNonLink>;
  }

  const arrow = direction ? (
    <StyledIconArrow size="xs" direction={direction === 'desc' ? 'down' : 'up'} />
  ) : null;

  const handleOnClick: React.MouseEventHandler<HTMLAnchorElement> = e => {
    if (replace) {
      e.preventDefault();
      navigate(target, {replace: true, preventScrollReset});
    }
    onClick?.(e);
  };

  return (
    <StyledLink
      align={align}
      to={target}
      onClick={handleOnClick}
      preventScrollReset={preventScrollReset}
    >
      {title} {arrow}
    </StyledLink>
  );
}

type LinkProps = React.ComponentPropsWithoutRef<typeof Link>;
type StyledLinkProps = LinkProps & {align: ColumnAlign};

const StyledLink = styled((props: StyledLinkProps) => {
  // but prior to this style of destructure-omitting it, it was being omitted
  // with lodash.omit. I mean keeping it omitted here just in case.
  // @ts-expect-error TS(2339): Property 'css' does not exist on type 'StyledLinkP... Remove this comment to see the full error message
  const {align: _align, css: _css, ...forwardProps} = props;
  return <Link {...forwardProps} />;
})`
  display: block;
  width: 100%;
  white-space: nowrap;
  color: inherit;

  &:hover,
  &:active,
  &:focus,
  &:visited {
    color: inherit;
  }

  ${(p: StyledLinkProps) =>
    p.align
      ? css`
          text-align: ${p.align};
        `
      : ''}
`;

const StyledNonLink = styled('div')<{align: ColumnAlign}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  ${(p: {align: ColumnAlign}) =>
    p.align
      ? css`
          text-align: ${p.align};
        `
      : ''}
`;

const StyledIconArrow = styled(IconArrow)`
  vertical-align: top;
`;
