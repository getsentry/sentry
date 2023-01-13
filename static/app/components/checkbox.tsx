import {useEffect, useRef} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import type {Interpolation} from '@emotion/styled';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconCheckmark, IconSubtract} from 'sentry/icons';
import type {FormSize} from 'sentry/utils/theme';

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

interface Props extends Omit<CheckboxProps, 'checked' | 'size'> {
  /**
   * Is the checkbox active? Supports 'indeterminate'
   */
  checked?: CheckboxProps['checked'] | 'indeterminate';
  /**
   * Styles to be applied to the hidden <input> element.
   */
  inputCss?: Interpolation<Theme>;
  /**
   * The size of the checkbox. Defaults to 'sm'.
   */
  size?: FormSize;
}

type CheckboxConfig = {
  borderRadius: string;
  box: string;
  // TODO: We should use IconSize here, but the `xs` checkmark needs the
  // smaller icon size right now, so we use legacySize
  icon: string;
};

const checkboxSizeMap: Record<FormSize, CheckboxConfig> = {
  xs: {box: '12px', borderRadius: '2px', icon: '10px'},
  sm: {box: '16px', borderRadius: '4px', icon: '12px'},
  md: {box: '22px', borderRadius: '6px', icon: '16px'},
};

const Checkbox = ({
  className,
  inputCss,
  checked = false,
  size = 'sm',
  ...props
}: Props) => {
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
      <StyledCheckbox aria-hidden checked={checked} size={size}>
        {checked === true && <IconCheckmark legacySize={checkboxSizeMap[size].icon} />}
        {checked === 'indeterminate' && (
          <IconSubtract legacySize={checkboxSizeMap[size].icon} />
        )}
      </StyledCheckbox>
      {!props.disabled && (
        <InteractionStateLayer
          higherOpacity={checked === true || checked === 'indeterminate'}
        />
      )}
    </Wrapper>
  );
};

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
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 2px;
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
    p.checked
      ? css`
          background: ${p.theme.active};
          border: 0;
        `
      : css`
          background: ${p.theme.background};
          border: 1px solid ${p.theme.gray200};
        `}
`;

export default Checkbox;
