import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import InlineSvg from 'app/components/inlineSvg';

class CheckboxFancy extends React.Component {
  static defaultProps = {
    checked: false,
  };

  render() {
    return (
      <CheckboxContainer
        role="checkbox"
        aria-checked={this.props.checked}
        checked={this.props.checked}
        {...this.props}
      >
        {this.props.checked && <Check src="icon-checkmark-sm" />}
      </CheckboxContainer>
    );
  }
}

const CheckboxContainer = styled('div')`
  width: 18px;
  height: 18px;
  border-radius: 18px;
  background: ${p => p.checked ? p.theme.purple : null};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 1px 1px 1px 1px rgba(0,0,0,0.01) inset;
  border: 1px solid ${p => p.checked ? p.theme.purple : p.theme.gray1};
`;

const Check = styled(InlineSvg)`
  width: 50%;
  height: 50%;
  color: #fff;
`

export default CheckboxFancy;
