import React from 'react';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';

import IconArrow from 'app/icons/iconArrow';
import Link from 'app/components/links/link';
import {Field, Sort} from 'app/utils/discover/fields';
import EventView, {MetaType, isFieldSortable} from 'app/utils/discover/eventView';

export type Alignments = 'left' | 'right' | undefined;

type Props = {
  align: Alignments;
  field: Field;
  eventView: EventView;
  generateSortLink: () => LocationDescriptorObject | undefined;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  tableDataMeta?: MetaType; // Will not be defined if data is not loaded
};

class SortLink extends React.Component<Props> {
  isCurrentColumnSorted(): Sort | undefined {
    const {eventView, field, tableDataMeta} = this.props;
    if (!tableDataMeta) {
      return undefined;
    }

    return eventView.isFieldSorted(field, tableDataMeta);
  }

  renderArrow() {
    const currentSort = this.isCurrentColumnSorted();

    if (!currentSort) {
      return null;
    }

    if (currentSort.kind === 'desc') {
      return <StyledIconArrow size="xs" direction="down" />;
    }
    return <StyledIconArrow size="xs" direction="up" />;
  }

  render() {
    const {align, field, tableDataMeta, generateSortLink, onClick} = this.props;

    const target = generateSortLink();

    if (!target || !isFieldSortable(field, tableDataMeta)) {
      return <StyledNonLink align={align}>{field.field}</StyledNonLink>;
    }

    return (
      <StyledLink align={align} to={target} onClick={onClick}>
        {field.field} {this.renderArrow()}
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
