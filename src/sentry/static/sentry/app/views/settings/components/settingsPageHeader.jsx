import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

class SettingsPageHeading extends React.Component {
  static propTypes = {
    label: PropTypes.string,
    action: PropTypes.node,
  };

  render() {
    // Todo(ckj) support tabs
    return (
      <Wrapper>
        {this.props.label && (
          <LabelContainer>
            <Label>{this.props.label}</Label>
          </LabelContainer>
        )}
        {this.props.action && <div>{this.props.action}</div>}
      </Wrapper>
    );
  }
}

const Wrapper = styled.div`
  display: flex;
  font-size: 14px;
  box-shadow: inset 0 -1px 0 ${p => p.theme.borderLight};
  margin-bottom: 30px;
`;

const LabelContainer = styled.div`
  display: flex;
  flex: 1;
`;

const Label = styled.div`
  display: inline-block;
  font-weight: bold;
  padding-bottom: 14px;
  border-bottom: 3px solid ${p => p.theme.purple};
`;

export default SettingsPageHeading;
