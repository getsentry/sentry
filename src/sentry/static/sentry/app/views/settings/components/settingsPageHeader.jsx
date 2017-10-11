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
            <Label>
              <LabelText>{this.props.label}</LabelText>
            </Label>
          </LabelContainer>
        )}
        {this.props.action && <div>{this.props.action}</div>}
      </Wrapper>
    );
  }
}

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  font-size: 14px;
  box-shadow: inset 0 -1px 0 ${p => p.theme.borderLight};
  margin-bottom: 30px;
`;

const LabelContainer = styled.div`
  display: flex;
  flex: 1;
`;

// Label w/ border
const Label = styled.div`
  display: flex;
  align-items: center;
  font-weight: bold;
  border-bottom: 3px solid ${p => p.theme.purple};
`;

// Label text only
const LabelText = styled.span`
  padding: 14px 0;
`;

export default SettingsPageHeading;
