import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Location} from 'history';
import {omit} from 'lodash';

import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';

type Alignments = 'left' | 'right' | undefined;

type Props = {
  title: string;
  sortKey: string;
  defaultSort: string;
  location: Location;
  align: Alignments;
};

class SortLink extends React.Component<Props> {
  static propTypes = {
    align: PropTypes.string,
    title: PropTypes.string.isRequired,
    sortKey: PropTypes.string.isRequired,
    defaultSort: PropTypes.string.isRequired,
    location: PropTypes.object.isRequired,
  };

  getCurrentSort(): string {
    const {defaultSort, location} = this.props;
    return typeof location.query.sort === 'string' ? location.query.sort : defaultSort;
  }

  getSort() {
    const {sortKey} = this.props;
    const currentSort = this.getCurrentSort();

    // Page is currently unsorted or is ascending
    if (currentSort === `-${sortKey}`) {
      return sortKey;
    }

    // Reverse direction
    return `-${sortKey}`;
  }

  getTarget() {
    const {location} = this.props;
    return {
      pathname: location.pathname,
      query: {...location.query, sort: this.getSort()},
    };
  }

  renderChevron() {
    const currentSort = this.getCurrentSort();
    const {sortKey} = this.props;
    if (!currentSort || currentSort.indexOf(sortKey) === -1) {
      return null;
    }

    if (currentSort[0] === '-') {
      return <InlineSvg src="icon-chevron-down" />;
    }

    return <InlineSvg src="icon-chevron-up" />;
  }

  render() {
    const {align, title} = this.props;
    return (
      <StyledLink align={align} to={this.getTarget()}>
        {title} {this.renderChevron()}
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

export default SortLink;
