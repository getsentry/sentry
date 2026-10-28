import type * as React from 'react';
import {useCallback} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import type {FormSize} from '@sentry/scraps/theme';
import {Tooltip, useDisabledTooltip, type TooltipProps} from '@sentry/scraps/tooltip';

type CheckboxConfig = {
  borderRadius: string;
  box: string;
  icon: string;
};

const NativeHiddenCheckbox = styled('input')`
  position: absolute;
  opacity: 0;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  cursor: ${p => (p.disabled || p.readOnly ? 'initial' : 'pointer')};

  &[aria-disabled='true'] {
    cursor: initial;
  }

  & + * {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.rest};
    color: ${p => p.theme.tokens.content.onVibrant.light};
    border: 1px solid ${p => p.theme.tokens.border.primary};

    svg {
      stroke: ${p => p.theme.colors.white};
    }
  }

  &:focus-visible + * {
    ${p => p.theme.focusRing()};
  }

  &:disabled + *,
  &[aria-disabled='true'] + * {
    opacity: ${p => p.theme.tokens.interactive.disabled};
    cursor: not-allowed;
  }

  &:checked + *,
  &:indeterminate + * {
    background-color: ${p =>
      p.theme.tokens.interactive.chonky.debossed.accent.background};
    color: ${p => p.theme.tokens.content.onVibrant.light};
  }

  &:disabled:checked + *,
  &:disabled:indeterminate + *,
  &[aria-disabled='true']:checked + *,
  &[aria-disabled='true']:indeterminate + * {
    background-color: ${p =>
      p.theme.tokens.interactive.chonky.debossed.accent.background};
    border: 1px solid ${p => p.theme.tokens.interactive.chonky.debossed.accent.chonk};
    opacity: ${p => p.theme.tokens.interactive.disabled};
  }
`;

const checkboxSizeMap: Record<NonNullable<CheckboxProps['size']>, CheckboxConfig> = {
  xs: {box: '12px', borderRadius: '2px', icon: '10px'},
  sm: {box: '16px', borderRadius: '4px', icon: '12px'},
  md: {box: '22px', borderRadius: '6px', icon: '18px'},
};

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'checked' | 'size'
> {
  /**
   * Is the checkbox active? Supports 'indeterminate'
   */
  checked?: React.InputHTMLAttributes<HTMLInputElement>['checked'] | 'indeterminate';
  /**
   * Ref to the native checkbox input element.
   */
  ref?: React.Ref<HTMLInputElement>;
  /**
   * The size of the checkbox. Defaults to 'sm'.
   */
  size?: FormSize;
  /** Tooltip shown on hover or focus. Requires a title when provided. */
  tooltipProps?: Omit<TooltipProps, 'children' | 'skipWrapper'>;
}

function preventInteraction(event: React.SyntheticEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

export function Checkbox({
  checked = false,
  disabled,
  size = 'sm',
  className,
  ref,
  tooltipProps,
  ...props
}: CheckboxProps) {
  const {isFocusableDisabled, disabledProps} = useDisabledTooltip({
    disabled,
    tooltipProps,
    onKeyDown: props.onKeyDown,
    'aria-disabled': props['aria-disabled'],
  });

  const nativeCheckBoxRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (node) {
        node.indeterminate = checked === 'indeterminate';
      }
    },
    [checked]
  );

  const wrapperProps: React.HTMLAttributes<HTMLDivElement> = {
    className,
    style: props.style,
  };

  return (
    <CheckboxWrapper
      size={size}
      disabled={disabled}
      readOnly={props.readOnly}
      {...wrapperProps}
    >
      <Tooltip skipWrapper {...tooltipProps} title={tooltipProps?.title}>
        <NativeHiddenCheckbox
          ref={mergeRefs(nativeCheckBoxRef, ref)}
          checked={checked !== 'indeterminate' && checked}
          type="checkbox"
          {...props}
          {...disabledProps}
          // aria-disabled keeps the checkbox focusable for its tooltip, but the browser
          // still toggles it and includes it in form data and required validation.
          // Block those to match native disabled behavior.
          {...(isFocusableDisabled && {
            onClickCapture: preventInteraction,
            onChange: preventInteraction,
            name: undefined,
            required: undefined,
          })}
        />
      </Tooltip>

      <FakeCheckbox aria-hidden size={size}>
        {(checked === true || checked === 'indeterminate') && (
          <CheckboxIcon viewBox="0 0 16 16" size={checkboxSizeMap[size].icon}>
            {checked === 'indeterminate' ? (
              <path d="M3 8H13" />
            ) : (
              <path d="M2.86 9.14C4.42 10.7 6.9 13.14 6.86 13.14L12.57 3.43" />
            )}
          </CheckboxIcon>
        )}
      </FakeCheckbox>
    </CheckboxWrapper>
  );
}

const CheckboxWrapper = styled('div', {
  shouldForwardProp: prop =>
    typeof prop === 'string' &&
    isPropValid(prop) &&
    !['disabled', 'readOnly'].includes(prop),
})<{
  size: NonNullable<CheckboxProps['size']>;
  disabled?: boolean;
  readOnly?: boolean;
}>`
  position: relative;
  cursor: ${p => (p.disabled || p.readOnly ? 'initial' : 'pointer')};
  display: inline-flex;
  justify-content: flex-start;
  border-radius: ${p => checkboxSizeMap[p.size].borderRadius};

  &::after {
    content: '';
    display: ${p => (p.disabled || p.readOnly ? 'none' : 'block')};
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-color: currentcolor;
    pointer-events: none;
    opacity: 0;
  }

  &:hover::after {
    opacity: 0.06;
  }

  &:has(input:checked, input:indeterminate):hover::after {
    opacity: 0.085;
  }

  &:active::after {
    opacity: 0.09;
  }

  &:has(input:checked, input:indeterminate):active::after {
    opacity: 0.12;
  }
`;

const FakeCheckbox = styled('div')<{
  size: NonNullable<CheckboxProps['size']>;
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  width: ${p => checkboxSizeMap[p.size].box};
  height: ${p => checkboxSizeMap[p.size].box};
  border-radius: ${p => checkboxSizeMap[p.size].borderRadius};
  pointer-events: none;
`;

const CheckboxIcon = styled('svg')<{size: string}>`
  width: ${p => p.size};
  height: ${p => p.size};

  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: calc(1.4px + ${p => p.size} * 0.04);
`;
