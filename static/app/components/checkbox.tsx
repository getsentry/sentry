import {useEffect, useRef} from 'react';
import {css, Theme} from '@emotion/react';
import styled, {Interpolation} from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {FormSize} from 'sentry/utils/theme';

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

interface Props extends Omit<CheckboxProps, 'checked' | 'size'> {
  /**
   * The background color of the filled in checkbox.
   */
  checkboxColor?: string;
  /**
   * Is the checkbox active? Supports 'indeterminate'
   */
  checked?: CheckboxProps['checked'] | 'indeterminate';
  /**
   * Styles to be applied to the hidden <input> element.
   */
  inputCss?: Interpolation<Theme>;
  /**
   * Whether to invert the colors of the checkbox and the checkmark.
   */
  invertColors?: boolean;
  /**
   * The size of the checkbox. Defaults to 'sm'.
   */
  size?: FormSize;
}

type CheckboxConfig = {
  borderRadius: string;
  box: string;
  icon: string;
};

const checkboxSizeMap: Record<FormSize, CheckboxConfig> = {
  xs: {box: '12px', borderRadius: '2px', icon: '10px'},
  sm: {box: '16px', borderRadius: '4px', icon: '12px'},
  md: {box: '22px', borderRadius: '6px', icon: '18px'},
};

function Checkbox({
  checkboxColor,
  className,
  inputCss,
  checked = false,
  invertColors,
  size = 'sm',
  ...props
}: Props) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Support setting the indeterminate value, which is only possible through
  // setting this attribute
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = checked === 'indeterminate';
    }
  }, [checked]);

  return (
    <Wrapper {...{className, checked, size}}>
      <HiddenInput
        ref={checkboxRef}
        css={inputCss}
        checked={checked !== 'indeterminate' && checked}
        type="checkbox"
        {...props}
      />

      <StyledCheckbox
        aria-hidden
        checked={checked}
        size={size}
        color={checkboxColor}
        invertColors={invertColors}
      >
        {checked === true && (
          <VariableWeightIcon
            viewBox="0 0 16 16"
            size={checkboxSizeMap[size].icon}
            invertColors={props.disabled ? false : invertColors}
          >
            <path d="M2.86 9.14C4.42 10.7 6.9 13.14 6.86 13.14L12.57 3.43" />
          </VariableWeightIcon>
        )}
        {checked === 'indeterminate' && (
          <VariableWeightIcon viewBox="0 0 16 16" size={checkboxSizeMap[size].icon}>
            <path d="M3 8H13" />
          </VariableWeightIcon>
        )}
      </StyledCheckbox>
      {!props.disabled && (
        <InteractionStateLayer
          higherOpacity={checked === true || checked === 'indeterminate'}
        />
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')<{checked: Props['checked']; size: FormSize}>`
  position: relative;
  cursor: pointer;
  display: inline-flex;
  justify-content: flex-start;
  color: ${p => (p.checked ? p.theme.white : p.theme.textColor)};
  border-radius: ${p => checkboxSizeMap[p.size].borderRadius};
`;

const HiddenInput = styled('input')`
  position: absolute;
  opacity: 0;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  cursor: pointer;

  &.focus-visible + * {
    ${p =>
      p.checked
        ? `
        box-shadow: ${p.theme.focus} 0 0 0 3px;
      `
        : `
        border-color: ${p.theme.focusBorder};
        box-shadow: ${p.theme.focusBorder} 0 0 0 1px;
      `}
  }

  &:disabled + * {
    ${p =>
      p.checked
        ? css`
            background: ${p.theme.disabled};
          `
        : css`
            background: ${p.theme.backgroundSecondary};
            border-color: ${p.theme.disabledBorder};
          `}
  }
`;

const StyledCheckbox = styled('div')<{
  checked: Props['checked'];
  size: FormSize;
  color?: Props['checkboxColor'];
  invertColors?: Props['invertColors'];
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  box-shadow: ${p => p.theme.dropShadowMedium} inset;
  width: ${p => checkboxSizeMap[p.size].box};
  height: ${p => checkboxSizeMap[p.size].box};
  border-radius: ${p => checkboxSizeMap[p.size].borderRadius};
  pointer-events: none;

  ${p =>
    p.invertColors
      ? css`
          background: ${p.theme.white};
          border: 0;
        `
      : p.checked
      ? css`
          background: ${p.color ?? p.theme.active};
          border: 0;
        `
      : css`
          background: ${p.theme.background};
          border: 1px solid ${p.theme.gray200};
        `}
`;

const VariableWeightIcon = styled('svg')<{size: string; invertColors?: boolean}>`
  width: ${p => p.size};
  height: ${p => p.size};

  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke: ${p => (p.invertColors ? p.theme.active : p.theme.white)};
  stroke-width: calc(1.4px + ${p => p.size} * 0.04);
`;

export default Checkbox;
