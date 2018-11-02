import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import space from 'app/styles/space';

const SelectorItem = styled(
  class SelectorItem extends React.PureComponent {
    static propTypes = {
      onClick: PropTypes.func.isRequired,
      value: PropTypes.string,
      label: PropTypes.node,
    };

    handleClick = e => {
      let {onClick, value} = this.props;
      onClick(value, e);
    };

    render() {
      let {className, label} = this.props;
      return (
        <Flex className={className} onClick={this.handleClick}>
          <Label>{label}</Label>
        </Flex>
      );
    }
  }
)`
  cursor: pointer;
  white-space: nowrap;
  padding: ${space(1)};
  align-items: center;
  flex: 1;
  background-color: ${p => (p.selected ? p.theme.offWhite : 'transpatent')};
  font-weight: ${p => (p.selected ? 'bold' : 'normal')};
  border-bottom: 1px solid ${p => (p.last ? 'transparent' : p.theme.borderLight)};

  &:hover {
    background: ${p => p.theme.offWhite};
  }
`;

const Label = styled('span')`
  flex: 1;
  margin-right: ${space(1)};
`;

export default SelectorItem;
