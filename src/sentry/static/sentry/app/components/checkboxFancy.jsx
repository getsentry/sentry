import React from 'react';
import styled, {css} from 'react-emotion';
import PropTypes from 'prop-types';
import InlineSvg from 'app/components/inlineSvg';

const getDisabledStyles = p =>
  p.disabled &&
  css`
    background: ${p.checked ? p.theme.gray1 : p.theme.offWhite};
    border-color: ${p.theme.gray1};
  `;

const getHoverStyles = p =>
  !p.disabled &&
  css`
    border: 2px solid ${p.checked ? p.theme.purple : p.theme.gray4};
  `;

const CheckboxFancy = styled(({checked, disabled, ...props}) => (
  <div role="checkbox" aria-disabled={disabled} aria-checked={checked} {...props}>
    {checked && <Check src="icon-checkmark-sm" />}
  </div>
))`
  width: ${p => p.size};
  height: ${p => p.size};
  border-radius: 5px;
  background: ${p => (p.checked ? p.theme.purple : null)};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 1px 1px 5px 0px rgba(0, 0, 0, 0.05) inset;
  border: 2px solid ${p => (p.checked ? p.theme.purple : p.theme.gray2)};
  cursor: ${p => (p.disabled ? 'disabled' : 'pointer')};
  ${p => !p.checked && 'transition: 500ms border ease-out'};

  &:hover {
    ${getHoverStyles}
  }

  ${getDisabledStyles}
`;

CheckboxFancy.defaultProps = {
  checked: false,
  size: '16px',
};

CheckboxFancy.propTypes = {
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  size: PropTypes.string,
};

const Check = styled(InlineSvg)`
  width: 70%;
  height: 70%;
  color: #fff;
`;

export default CheckboxFancy;
