import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

class CheckboxFancy extends React.Component {
  static propTypes = {
    checked: PropTypes.bool,
  };

  static defaultProps = {
    checked: false,
  };

  render() {
    const {checked} = this.props;

    return (
      <CheckboxContainer
        role="checkbox"
        aria-checked={this.props.checked}
        {...this.props}
      >
        {checked && <Check src="icon-checkmark-sm" />}
      </CheckboxContainer>
    );
  }
}

const CheckboxContainer = styled('div')`
  width: ${space(2)};
  height: ${space(2)};
  border-radius: ${space(2)};
  background: ${p => (p.checked ? p.theme.purple : null)};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 1px 1px 1px 1px rgba(0, 0, 0, 0.01) inset;
  border: 1px solid ${p => (p.checked ? p.theme.purple : p.theme.gray1)};
`;

const Check = styled(InlineSvg)`
  width: 70%;
  height: 70%;
  color: #fff;
`;

export default CheckboxFancy;
