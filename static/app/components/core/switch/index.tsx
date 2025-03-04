import {forwardRef} from 'react';
import styled from '@emotion/styled';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLButtonElement>, 'size' | 'type'> {
  className?: string;
  size?: 'sm' | 'lg';
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({size = 'sm', ...props}: SwitchProps, ref) => {
    return (
      <SwitchButton
        ref={ref}
        data-test-id="switch"
        type="button"
        role="checkbox"
        aria-checked={props.checked}
        size={size}
        {...props}
      >
        <Toggle disabled={props.disabled} checked={props.checked} size={size} />
      </SwitchButton>
    );
  }
);

type StyleProps = Pick<SwitchProps, 'size' | 'checked' | 'disabled'>;

const getSize = (p: StyleProps) => (p.size === 'sm' ? 16 : 24);
const getToggleSize = (p: StyleProps) => getSize(p) - (p.size === 'sm' ? 4 : 8);
const getToggleTop = (p: StyleProps) => (p.size === 'sm' ? 1 : 3);
const getTranslateX = (p: StyleProps) =>
  p.checked ? getToggleTop(p) + getSize(p) * 0.875 : getToggleTop(p);

const SwitchButton = styled('button')<StyleProps>`
  display: inline-block;
  background: none;
  padding: 0;
  border: 1px solid ${p => p.theme.border};
  position: relative;
  box-shadow: inset ${p => p.theme.dropShadowMedium};
  height: ${getSize}px;
  width: ${p => getSize(p) * 1.875}px;
  border-radius: ${getSize}px;
  transition:
    border 0.1s,
    box-shadow 0.1s;

  span {
    background: ${p => (p.checked ? p.theme.active : p.theme.border)};
    opacity: ${p => (p.disabled ? 0.4 : null)};
  }

  &:disabled {
    pointer-events: none;
    cursor: not-allowed;
  }

  &:focus,
  &:focus-visible {
    outline: none;
    border-color: ${p => p.theme.focusBorder};
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 1px;
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
`;
