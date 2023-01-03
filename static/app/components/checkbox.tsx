import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconCheckmark, IconSubtract} from 'sentry/icons';
import {FormSize} from 'sentry/utils/theme';

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

interface Props extends Omit<CheckboxProps, 'checked' | 'size'> {
  /**
   * Is the checkbox active? Supports 'indeterminate'
   */
  checked?: CheckboxProps['checked'] | 'indeterminate';
  /**
   *
   */
  size?: FormSize;
}

type CheckboxConfig = {borderRadius: string; box: string; icon: string};

const checkboxSizeMap: Record<FormSize, CheckboxConfig> = {
  xs: {box: '12px', icon: '10px', borderRadius: '2px'},
  sm: {box: '16px', icon: '12px', borderRadius: '4px'},
  md: {box: '22px', icon: '16px', borderRadius: '6px'},
};

const Checkbox = ({checked = false, size = 'sm', ...props}: Props) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Support setting the indeterminate value, which is only possible through
  // setting this attribute
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = checked === 'indeterminate';
    }
  }, [checked]);

  return (
    <Wrapper {...{checked, size}}>
      <HiddenInput
        checked={checked !== 'indeterminate' && checked}
        type="checkbox"
        {...props}
      />
      <StyledCheckbox aria-hidden checked={checked} size={size}>
        {checked === true && <IconCheckmark size={checkboxSizeMap[size].icon} />}
        {checked === 'indeterminate' && (
          <IconSubtract size={checkboxSizeMap[size].icon} />
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
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
  margin: 0;
  cursor: pointer;

  &.focus-visible + * {
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 2px;
  }

  &:disabled + * {
    background: ${p => (p.checked ? p.theme.disabled : p.theme.backgroundSecondary)};
    border-color: ${p => (p.checked ? p.theme.disabled : p.theme.disabledBorder)};
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
  box-shadow: ${p => p.theme.dropShadowLight} inset;
  width: ${p => checkboxSizeMap[p.size].box};
  height: ${p => checkboxSizeMap[p.size].box};
  border-radius: ${p => checkboxSizeMap[p.size].borderRadius};
  background: ${p => (p.checked ? p.theme.active : p.theme.background)};
  border: 1px solid ${p => (p.checked ? p.theme.active : p.theme.gray200)};
  pointer-events: none;
`;

export default Checkbox;
