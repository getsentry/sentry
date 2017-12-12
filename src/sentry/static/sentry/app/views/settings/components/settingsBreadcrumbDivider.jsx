import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import IconChevronRight from '../../../icons/icon-chevron-right';

const StyledDivider = styled.span`
  display: inline-block;
  margin-left: 6px;
  color: ${p => p.theme.gray1};
  position: relative;
  top: -1px;

  ${p =>
    p.isHover
      ? `
    transform: rotate(90deg);
    top: 0;
    `
      : ''};
`;

class SettingsBreadcrumbDivider extends React.Component {
  static propTypes = {
    isHover: PropTypes.bool,
    isLast: PropTypes.bool,
  };
  render() {
    let {isHover, isLast} = this.props;
    if (isLast) return null;

    return (
      <StyledDivider isHover={isHover}>
        <IconChevronRight size="15" />
      </StyledDivider>
    );
  }
}

export default SettingsBreadcrumbDivider;
