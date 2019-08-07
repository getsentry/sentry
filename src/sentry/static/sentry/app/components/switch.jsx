import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

class Switch extends React.Component {
  static propTypes = {
    id: PropTypes.string,
    size: PropTypes.oneOf(['sm', 'lg']).isRequired,
    isActive: PropTypes.bool,
    isLoading: PropTypes.bool,
    isDisabled: PropTypes.bool,
    toggle: PropTypes.func.isRequired,
  };

  static defaultProps = {
    size: 'sm',
  };

  render() {
    const {size, isActive, isLoading, isDisabled, toggle, id, className} = this.props;

    return (
      <SwitchButton
        id={id}
        type="button"
        className={className}
        onClick={isDisabled ? null : toggle}
        role="checkbox"
        aria-checked={isActive}
        isLoading={isLoading}
        isDisabled={isDisabled}
        isActive={isActive}
        size={size}
        data-test-id="switch"
      >
        <Toggle isDisabled={isDisabled} isActive={isActive} size={size} />
      </SwitchButton>
    );
  }
}

const getSize = p => (p.size === 'sm' ? 16 : 24);
const getToggleSize = p => getSize(p) - (p.size === 'sm' ? 6 : 10);
const getToggleTop = p => (p.size === 'sm' ? 2 : 4);
const getTranslateX = p => (p.isActive ? getToggleTop(p) + getSize(p) : getToggleTop(p));

const SwitchButton = styled('button')`
  display: inline-block;
  background: none;
  padding: 0;
  border: 1px solid ${p => (p.isActive ? p.theme.borderDark : p.theme.borderLight)};
  position: relative;
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.04);
  transition: 0.15s border ease;
  cursor: ${p => (p.isLoading || p.isDisabled ? 'not-allowed' : 'pointer')};
  pointer-events: ${p => (p.isLoading || p.isDisabled ? 'none' : null)};
  height: ${getSize}px;
  width: ${p => getSize(p) * 2}px;
  border-radius: ${getSize}px;

  &:hover,
  &:focus {
    outline: none;
    border-color: ${p => p.theme.borderDark};
  }

  &:focus,
  &.focus-visible {
    outline: none;
    box-shadow: rgba(209, 202, 216, 0.5) 0 0 0 3px;
  }
`;

const Toggle = styled('span')`
  display: block;
  position: absolute;
  border-radius: 50%;
  transition: 0.25s all ease;
  top: ${getToggleTop}px;
  transform: translateX(${getTranslateX}px);
  width: ${getToggleSize}px;
  height: ${getToggleSize}px;
  background: ${p => (p.isActive ? p.theme.green : p.theme.gray6)};
  opacity: ${p => (p.isDisabled ? 0.4 : null)};
`;

export default Switch;
