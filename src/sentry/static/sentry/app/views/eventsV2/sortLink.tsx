import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Location} from 'history';
import omit from 'lodash/omit';

import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';

import EventView, {Field, Sort, isFieldSortable} from './eventView';
import {MetaType} from './utils';

type Alignments = 'left' | 'right' | undefined;

type Props = {
  align: Alignments;
  field: Field;
  location: Location;
  eventView: EventView;
  tableDataMeta: MetaType;
};

class SortLink extends React.Component<Props> {
  static propTypes = {
    align: PropTypes.string,
    field: PropTypes.object.isRequired,
    location: PropTypes.object.isRequired,
    eventView: PropTypes.object.isRequired,
    tableDataMeta: PropTypes.object.isRequired,
  };

  isCurrentColumnSorted(): Sort | undefined {
    const {eventView, field, tableDataMeta} = this.props;

    return eventView.isFieldSorted(field, tableDataMeta);
  }

  getTarget() {
    const {location, field, eventView, tableDataMeta} = this.props;

    const nextEventView = eventView.sortOnField(field, tableDataMeta);
    const queryStringObject = nextEventView.generateQueryStringObject();

    return {
      ...location,
      query: queryStringObject,
    };
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
    const {align, field, tableDataMeta} = this.props;

    if (!isFieldSortable(field, tableDataMeta)) {
      return <StyledNonLink align={align}>{field.title}</StyledNonLink>;
    }

    return (
      <StyledLink align={align} to={this.getTarget()}>
        {field.title} {this.renderChevron()}
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
  ${(p: StyledLinkProps) => (p.align ? `text-align: ${p.align};` : '')}
`;

const StyledNonLink = styled('div')<{align: Alignments}>`
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;

export default SortLink;
