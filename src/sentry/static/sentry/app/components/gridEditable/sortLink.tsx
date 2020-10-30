import React from 'react';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';

import {IconArrow} from 'app/icons';
import Link from 'app/components/links/link';

export type Alignments = 'left' | 'right' | undefined;
export type Directions = 'desc' | 'asc' | undefined;

type Props = {
  align: Alignments;
  title: React.ReactNode;
  direction: Directions;
  canSort: boolean;

  generateSortLink: () => LocationDescriptorObject | undefined;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

class SortLink extends React.Component<Props> {
  renderArrow() {
    const {direction} = this.props;
    if (!direction) {
      return null;
    }

    if (direction === 'desc') {
      return <StyledIconArrow size="xs" direction="down" />;
    }
    return <StyledIconArrow size="xs" direction="up" />;
  }

  render() {
    const {align, title, canSort, generateSortLink, onClick} = this.props;

    const target = generateSortLink();

    if (!target || !canSort) {
      return <StyledNonLink align={align}>{title}</StyledNonLink>;
    }

    return (
      <StyledLink align={align} to={target} onClick={onClick}>
        {title} {this.renderArrow()}
      </StyledLink>
    );
  }
}

type LinkProps = React.ComponentPropsWithoutRef<typeof Link>;
type StyledLinkProps = LinkProps & {align: Alignments};

const StyledLink = styled((props: StyledLinkProps) => {
  const forwardProps = omit(props, ['align']);
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
