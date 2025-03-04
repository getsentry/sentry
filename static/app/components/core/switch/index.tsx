import {forwardRef} from 'react';
import styled from '@emotion/styled';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLButtonElement>, 'size' | 'type'> {
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

const ToggleConfig = {
  sm: {
    size: 12,
    top: 1,
  },
  lg: {
    size: 16,
    top: 3,
  },
};

const getSize = (p: StyleProps) => (p.size === 'sm' ? 16 : 24);
const getTranslateX = (p: StyleProps) =>
  p.checked
    ? ToggleConfig[p.size ?? 'sm'].top + getSize(p) * 0.875
    : ToggleConfig[p.size ?? 'sm'].top;

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
  top: ${p => ToggleConfig[p.size ?? 'sm'].top}px;
  transform: translateX(${getTranslateX}px);
  width: ${p => ToggleConfig[p.size ?? 'sm'].size}px;
  height: ${p => ToggleConfig[p.size ?? 'sm'].size}px;
`;
