import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Location} from 'history';

import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';

type Props = {
  title: string;
  sortKey: string;
  defaultSort: string | undefined;
  location: Location;
};

class SortLink extends React.Component<Props> {
  static propTypes = {
    title: PropTypes.string.isRequired,
    sortKey: PropTypes.string.isRequired,
    defaultSort: PropTypes.string.isRequired,
    location: PropTypes.object.isRequired,
  };

  getCurrentSort() {
    const {defaultSort, location} = this.props;
    return location.query.sort ? location.query.sort : defaultSort;
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
    const {title} = this.props;
    return (
      <StyledLink to={this.getTarget()}>
        {title} {this.renderChevron()}
      </StyledLink>
    );
  }
}

const StyledLink = styled(Link)`
  white-space: nowrap;
`;

export default SortLink;
