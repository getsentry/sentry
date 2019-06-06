import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import space from 'app/styles/space';

class SelectorItem extends React.PureComponent {
  static propTypes = {
    onClick: PropTypes.func.isRequired,
    value: PropTypes.string,
    label: PropTypes.node,
    disabled: PropTypes.bool,
  };

  handleClick = e => {
    const {onClick, value, disabled} = this.props;
    if (disabled) {
      return null;
    }
    return onClick(value, e);
  };

  render() {
    const {className, label} = this.props;
    return (
      <Flex className={className} onClick={this.handleClick}>
        <Label>{label}</Label>
      </Flex>
    );
  }
}

const StyledSelectorItem = styled(SelectorItem)`
  cursor: pointer;
  white-space: nowrap;
  padding: ${space(1)};
  align-items: center;
  flex: 1;
  background-color: ${p => (p.selected ? p.theme.offWhite : 'transparent')};
  font-weight: ${p => (p.selected ? 'bold' : 'normal')};
  border-bottom: 1px solid ${p => (p.last ? 'transparent' : p.theme.borderLight)};
  color: ${p => p.disabled && p.theme.disabled};

  &:hover {
    background: ${p => !p.disabled && p.theme.offWhite};
  }
`;

const Label = styled('span')`
  flex: 1;
  margin-right: ${space(1)};
`;

export default StyledSelectorItem;
