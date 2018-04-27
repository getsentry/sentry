import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';
import space from 'app/styles/space';

class SettingsPageHeading extends React.Component {
  static propTypes = {
    icon: PropTypes.node,
    title: PropTypes.node,
    action: PropTypes.node,
    tabs: PropTypes.node,
  };

  render() {
    return (
      <Wrapper tabs={this.props.tabs}>
        <Flex align="center">
          {this.props.icon && <Box pr={1}>{this.props.icon}</Box>}
          {this.props.title && <Title>{this.props.title}</Title>}
          {this.props.action && <div>{this.props.action}</div>}
        </Flex>

        {this.props.tabs && <div>{this.props.tabs}</div>}
      </Wrapper>
    );
  }
}

const Wrapper = styled.div`
  font-size: 14px;
  box-shadow: inset 0 -1px 0 ${p => p.theme.borderLight};
  margin: -${space(3)} 0 ${space(3)};
`;

const Title = styled.div`
  font-size: 20px;
  font-weight: bold;
  margin: ${space(3)} 0;
  flex: 1;
`;

export default SettingsPageHeading;
