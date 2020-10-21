import PropTypes from 'prop-types';
import {Component} from 'react';
import styled from '@emotion/styled';

import {IconChevron} from 'app/icons';

const StyledDivider = styled('span')`
  display: inline-block;
  margin-left: 6px;
  color: ${p => p.theme.gray400};
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

const StyledIconChevron = styled(IconChevron)`
  display: block;
`;

class Divider extends Component {
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
        <StyledIconChevron direction="right" size="14px" />
      </StyledDivider>
    );
  }
}

export default Divider;
