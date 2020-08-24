import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

type Props = {
  forwardRef?: React.Ref<HTMLButtonElement>;
  className?: string;
  id?: string;
  name?: string;
  size?: 'sm' | 'lg';
  isActive?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  toggle: React.HTMLProps<HTMLButtonElement>['onClick'];
};

const Switch = ({
  forwardRef,
  size = 'sm',
  isActive,
  isLoading,
  isDisabled,
  toggle,
  id,
  name,
  className,
}: Props) => (
  <SwitchButton
    ref={forwardRef}
    id={id}
    name={name}
    type="button"
    className={className}
    onClick={isDisabled ? undefined : toggle}
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

Switch.propTypes = {
  id: PropTypes.string,
  forwardRef: PropTypes.any,
  size: PropTypes.oneOf(['sm', 'lg']),
  isActive: PropTypes.bool,
  isLoading: PropTypes.bool,
  isDisabled: PropTypes.bool,
  toggle: PropTypes.func.isRequired,
};

type StyleProps = Partial<Props>;

const getSize = (p: StyleProps) => (p.size === 'sm' ? 16 : 24);
const getToggleSize = (p: StyleProps) => getSize(p) - (p.size === 'sm' ? 6 : 10);
const getToggleTop = (p: StyleProps) => (p.size === 'sm' ? 2 : 4);
const getTranslateX = (p: StyleProps) =>
  p.isActive ? getToggleTop(p) + getSize(p) : getToggleTop(p);

const SwitchButton = styled('button')<StyleProps>`
  display: inline-block;
  background: none;
  padding: 0;
  border: 1px solid ${p => (p.isActive ? p.theme.border : p.theme.border)};
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
    border-color: ${p => p.theme.border};
  }

  &:focus,
  &.focus-visible {
    outline: none;
    box-shadow: rgba(209, 202, 216, 0.5) 0 0 0 3px;
  }
`;

const Toggle = styled('span')<StyleProps>`
  display: block;
  position: absolute;
  border-radius: 50%;
  transition: 0.25s all ease;
  top: ${getToggleTop}px;
  transform: translateX(${getTranslateX}px);
  width: ${getToggleSize}px;
  height: ${getToggleSize}px;
  background: ${p => (p.isActive ? p.theme.green400 : p.theme.gray400)};
  opacity: ${p => (p.isDisabled ? 0.4 : null)};
`;

export default React.forwardRef<HTMLButtonElement, Props>((props, ref) => (
  <Switch {...props} forwardRef={ref} />
));
