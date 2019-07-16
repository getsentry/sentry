import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';

class SortLink extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    sortKey: PropTypes.string.isRequired,
    location: PropTypes.object.isRequired,
  };

  getSort() {
    const {sortKey, location} = this.props;

    // Page has no explicit sorting
    if (!location.query.sort) {
      // Default to descending
      return `-${sortKey}`;
    }

    // Page is currently unsorted or is ascending
    if (location.query.sort === `-${sortKey}`) {
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
    const {location, sortKey} = this.props;
    if (!location.query.sort || location.query.sort.indexOf(sortKey) === -1) {
      return null;
    }

    if (location.query.sort[0] === '-') {
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
