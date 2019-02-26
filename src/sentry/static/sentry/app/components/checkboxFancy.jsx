import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import InlineSvg from 'app/components/inlineSvg';

class CheckboxFancy extends React.Component {
  static propTypes = {
    checked: PropTypes.bool,
    size: PropTypes.string,
  };

  static defaultProps = {
    checked: false,
    size: '16px',
  };

  render() {
    const {className, checked, size, ...props} = this.props;

    return (
      <CheckboxContainer
        role="checkbox"
        aria-checked={checked}
        className={className}
        checked={checked}
        size={size}
        {...props}
      >
        {checked && <Check src="icon-checkmark-sm" />}
      </CheckboxContainer>
    );
  }
}

const CheckboxContainer = styled('div')`
  width: ${p => p.size};
  height: ${p => p.size};
  border-radius: 5px;
  background: ${p => (p.checked ? p.theme.purple : null)};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 1px 1px 1px 0px rgba(0, 0, 0, 0.1) inset;
  border: 1px solid ${p => (p.checked ? p.theme.purple : p.theme.gray1)};

  &:hover {
    border: 1px solid ${p => (p.checked ? p.theme.purple : p.theme.gray2)};
  }
`;

const Check = styled(InlineSvg)`
  width: 70%;
  height: 70%;
  color: #fff;
`;

export default CheckboxFancy;
