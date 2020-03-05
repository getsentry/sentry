import React from 'react';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';

import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';

import EventView, {Field, Sort, isFieldSortable} from './eventView';
import {MetaType} from './utils';

export type Alignments = 'left' | 'right' | undefined;

type Props = {
  align: Alignments;
  field: Field;
  eventView: EventView;
  tableDataMeta?: MetaType; // Will not be defined if data is not loaded
  generateSortLink: () => LocationDescriptorObject | undefined;
};

class SortLink extends React.Component<Props> {
  isCurrentColumnSorted(): Sort | undefined {
    const {eventView, field, tableDataMeta} = this.props;
    if (!tableDataMeta) {
      return undefined;
    }

    return eventView.isFieldSorted(field, tableDataMeta);
  }

  renderChevron() {
    const currentSort = this.isCurrentColumnSorted();

    if (!currentSort) {
      return null;
    }

    if (currentSort.kind === 'desc') {
      return <InlineSvg src="icon-chevron-down" />;
    }

    return <InlineSvg src="icon-chevron-up" />;
  }

  render() {
    const {align, field, tableDataMeta, generateSortLink} = this.props;

    const target = generateSortLink();

    if (!target || !isFieldSortable(field, tableDataMeta)) {
      return <StyledNonLink align={align}>{field.field}</StyledNonLink>;
    }

    return (
      <StyledLink align={align} to={target}>
        {field.field} {this.renderChevron()}
      </StyledLink>
    );
  }
}

type StyledLinkProps = Link['props'] & {align: Alignments};

const StyledLink = styled((props: StyledLinkProps) => {
  const forwardProps = omit(props, ['align']);
  return <Link {...forwardProps} />;
})`
  display: block;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
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
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;

export default SortLink;
