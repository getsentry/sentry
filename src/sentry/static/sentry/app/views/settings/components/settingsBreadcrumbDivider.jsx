import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from '../../../components/inlineSvg';

const StyledDivider = styled.span`
  display: inline-block;
  margin-left: 6px;
  color: ${p => p.theme.borderDark};
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
        <InlineSvg src="icon-chevron-right" size="15" />
      </StyledDivider>
    );
  }
}

export default SettingsBreadcrumbDivider;
