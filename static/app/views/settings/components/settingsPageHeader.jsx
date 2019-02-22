import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import space from 'app/styles/space';
import {HeaderTitle} from 'app/styles/organization';

class SettingsPageHeading extends React.Component {
  static propTypes = {
    icon: PropTypes.node,
    title: PropTypes.node,
    action: PropTypes.node,
    tabs: PropTypes.node,
    // Disables font styles in the title. Allows for more custom titles.
    noTitleStyles: PropTypes.bool,
  };

  static defaultProps = {
    noTitleStyles: false,
  };

  render() {
    return (
      <Wrapper tabs={this.props.tabs}>
        <Flex align="center">
          {this.props.icon && <Box pr={1}>{this.props.icon}</Box>}
          {this.props.title && (
            <Title tabs={this.props.tabs} styled={this.props.noTitleStyles}>
              <HeaderTitle>{this.props.title}</HeaderTitle>
            </Title>
          )}
          {this.props.action && (
            <Action tabs={this.props.tabs}>{this.props.action}</Action>
          )}
        </Flex>

        {this.props.tabs && <div>{this.props.tabs}</div>}
      </Wrapper>
    );
  }
}

const Title = styled(Flex, {shouldForwardProp: p => p !== 'styled'})`
  ${p =>
    !p.styled &&
    `
    font-size: 20px;
    font-weight: bold;`};
  margin: ${p => (p.tabs ? `${space(4)} 0 ${space(2)}` : `${space(4)} 0`)};
  flex: 1;
`;

const Action = styled('div')`
  ${p => (p.tabs ? `margin-top: ${space(2)}` : null)};
`;

const Wrapper = styled.div`
  font-size: 14px;
  margin-top: -${space(4)};
`;

export default SettingsPageHeading;
