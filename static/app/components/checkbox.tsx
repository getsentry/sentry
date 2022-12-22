import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {useHover, usePress} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';

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
  const {isPressed, pressProps} = usePress({isDisabled: props.disabled});
  const {isHovered, hoverProps} = useHover({isDisabled: props.disabled});

  // Support setting the indeterminate value, which is only possible through
  // setting this attribute
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = checked === 'indeterminate';
    }
  }, [checked]);

  return (
    <Wrapper>
      <HiddenInput
        checked={checked !== 'indeterminate' && checked}
        type="checkbox"
        {...mergeProps({ref: checkboxRef}, pressProps, hoverProps, props)}
      />
      <StyledCheckbox aria-hidden checked={checked} size={size} {...pressProps}>
        {checked === true && <IconCheckmark size={checkboxSizeMap[size].icon} />}
        {checked === 'indeterminate' && (
          <IconSubtract size={checkboxSizeMap[size].icon} />
        )}
        <InteractionStateLayer {...{isPressed, isHovered}} />
      </StyledCheckbox>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  position: relative;
  cursor: pointer;
  display: inline-flex;
  justify-content: flex-start;
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
  color: ${p => (p.checked ? p.theme.white : p.theme.textColor)};
  box-shadow: ${p => p.theme.dropShadowLight} inset;
  width: ${p => checkboxSizeMap[p.size].box};
  height: ${p => checkboxSizeMap[p.size].box};
  border-radius: ${p => checkboxSizeMap[p.size].borderRadius};
  background: ${p => (p.checked ? p.theme.active : p.theme.background)};
  border: 1px solid ${p => (p.checked ? p.theme.active : p.theme.gray200)};
  pointer-events: none;
`;

export default Checkbox;
