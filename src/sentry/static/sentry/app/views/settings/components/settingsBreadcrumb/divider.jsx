import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import InlineSvg from 'app/components/inlineSvg';

const StyledDivider = styled('span')`
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

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
`;

class Divider extends React.Component {
  static propTypes = {
    isHover: PropTypes.bool,
    isLast: PropTypes.bool,
  };
  render() {
    const {isHover, isLast} = this.props;
    if (isLast) {
      return null;
    }

    return (
      <StyledDivider isHover={isHover}>
        <StyledInlineSvg src="icon-chevron-right" size="14px" />
      </StyledDivider>
    );
  }
}

export default Divider;
