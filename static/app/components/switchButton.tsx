import {forwardRef} from 'react';
import styled from '@emotion/styled';

type Props = {
  toggle: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  /**
   * Toggle color is always active.
   */
  forceActiveColor?: boolean;
  forwardedRef?: React.Ref<HTMLButtonElement>;
  id?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  name?: string;
  size?: 'sm' | 'lg';
};

function Switch({
  forwardedRef,
  size = 'sm',
  isActive,
  forceActiveColor,
  isLoading,
  isDisabled,
  toggle,
  id,
  name,
  className,
  ...props
}: Props) {
  return (
    <SwitchButton
      ref={forwardedRef}
      id={id}
      name={name}
      type="button"
      className={className}
      onClick={isDisabled ? undefined : toggle}
      role="checkbox"
      aria-checked={isActive}
      isLoading={isLoading}
      disabled={isDisabled}
      isActive={isActive}
      size={size}
      data-test-id="switch"
      {...props}
    >
      <Toggle
        isDisabled={isDisabled}
        isActive={isActive}
        forceActiveColor={forceActiveColor}
        size={size}
      />
    </SwitchButton>
  );
}

type StyleProps = Partial<Props>;

const getSize = (p: StyleProps) => (p.size === 'sm' ? 16 : 24);
const getToggleSize = (p: StyleProps) => getSize(p) - (p.size === 'sm' ? 4 : 8);
const getToggleTop = (p: StyleProps) => (p.size === 'sm' ? 1 : 3);
const getTranslateX = (p: StyleProps) =>
  p.isActive ? getToggleTop(p) + getSize(p) * 0.875 : getToggleTop(p);

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

  &[disabled] {
    cursor: not-allowed;
  }

  &:focus,
  &.focus-visible {
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
  background: ${p =>
    p.isActive || p.forceActiveColor ? p.theme.active : p.theme.border};
  opacity: ${p => (p.isDisabled ? 0.4 : null)};
`;

export default forwardRef<HTMLButtonElement, Props>((props, ref) => (
  <Switch {...props} forwardedRef={ref} />
));
