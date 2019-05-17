import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Tooltip from 'app/components/tooltip';
import overflowEllipsis from 'app/styles/overflowEllipsis';

class Category extends React.Component {
  static propTypes = {
    value: PropTypes.string,
    title: PropTypes.string,
    hideIfEmpty: PropTypes.bool,
  };

  render() {
    let value = this.props.value;
    if (!value) {
      value = 'generic';
      if (this.props.hideIfEmpty) {
        return null;
      }
    }
    let title = this.props.title;
    if (title) {
      title = title.replace('%s', value);
    } else {
      title = value;
    }
    // Display has room for approximately 10 wide chars before
    // overflowing to an ellipsis. We also don't want tooltips on 'exception'
    // which is 9 characters.
    if (title.length > 10) {
      return (
        <Tooltip title={title} containerDisplayMode="block">
          <CrumbCategory>{title}</CrumbCategory>
        </Tooltip>
      );
    }
    return <CrumbCategory title={title}>{title}</CrumbCategory>;
  }
}

export default Category;

const CrumbCategory = styled('span')`
  font-size: 95%;
  font-weight: bold;
  text-transform: none;
  padding-right: 10px;
  color: ${p => p.theme.gray5};

  ${overflowEllipsis}
`;
