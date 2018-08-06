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
    // Disables font styles in the title. Allows for more custom titles.
    noTitleStyles: PropTypes.bool,
  };

  static defualtProps = {
    noTitleStyles: false,
  };

  render() {
    return (
      <Wrapper tabs={this.props.tabs}>
        <Flex align="center">
          {this.props.icon && <Box pr={1}>{this.props.icon}</Box>}
          {this.props.title && (
            <Title styled={this.props.noTitleStyles}>{this.props.title}</Title>
          )}
          {this.props.action && <div>{this.props.action}</div>}
        </Flex>

        {this.props.tabs && <div>{this.props.tabs}</div>}
      </Wrapper>
    );
  }
}

const Title = styled(Flex)`
  ${p =>
    !p.styled &&
    `
    font-size: 20px;
    font-weight: bold;`};
  margin: ${space(3)} 0;
  flex: 1;
`;

const Wrapper = styled.div`
  font-size: 14px;
  box-shadow: inset 0 -1px 0 ${p => p.theme.borderLight};
  margin: -${space(3)} 0 ${space(3)};
`;

export default SettingsPageHeading;
