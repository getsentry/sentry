import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';

import Link from 'sentry/components/links/link';
import {IconArrow} from 'sentry/icons';
import {useNavigate} from 'sentry/utils/useNavigate';

export type Alignments = 'left' | 'right' | undefined;
export type Directions = 'desc' | 'asc' | undefined;

type Props = {
  align: Alignments;
  canSort: boolean;
  direction: Directions;
  generateSortLink: () => LocationDescriptorObject | undefined;
  title: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  replace?: boolean;
};

function SortLink({
  align,
  title,
  canSort,
  generateSortLink,
  onClick,
  direction,
  replace,
}: Props) {
  const target = generateSortLink();
  const navigate = useNavigate();

  if (!target || !canSort) {
    return <StyledNonLink align={align}>{title}</StyledNonLink>;
  }

  const arrow = !direction ? null : (
    <StyledIconArrow size="xs" direction={direction === 'desc' ? 'down' : 'up'} />
  );

  const handleOnClick: React.MouseEventHandler<HTMLAnchorElement> = e => {
    if (replace) {
      e.preventDefault();
      navigate(target, {replace: true});
    }
    onClick?.(e);
  };

  return (
    <StyledLink align={align} to={target} onClick={handleOnClick}>
      {title} {arrow}
    </StyledLink>
  );
}

type LinkProps = React.ComponentPropsWithoutRef<typeof Link>;
type StyledLinkProps = LinkProps & {align: Alignments};

const StyledLink = styled((props: StyledLinkProps) => {
  // @ts-expect-error It doesn't look like the `css` property is a part of the props,
  // but prior to this style of destructure-omitting it, it was being omitted
  // with lodash.omit. I mean keeping it omitted here just in case.
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

  ${(p: StyledLinkProps) => (p.align ? `text-align: ${p.align};` : '')}
`;

const StyledNonLink = styled('div')<{align: Alignments}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;

const StyledIconArrow = styled(IconArrow)`
  vertical-align: top;
`;

export default SortLink;
