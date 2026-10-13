import {useCallback} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Tooltip, type ControlTooltipProps} from '@sentry/scraps/tooltip';

import type {FormSize} from 'sentry/utils/theme';

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

  &:is(:disabled, [aria-disabled='true']):is(:checked, :indeterminate) + * {
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
  /** Explains why a disabled checkbox cannot be changed. */
  tooltipProps?: ControlTooltipProps;
}

function preventDisabledInteraction(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function Checkbox({
  checked = false,
  size = 'sm',
  className,
  ref,
  tooltipProps,
  ...props
}: CheckboxProps) {
  const disabledWithTooltip = Boolean(
    props.disabled && tooltipProps?.title && !tooltipProps.disabled
  );

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
      disabled={props.disabled}
      readOnly={props.readOnly}
      onClickCapture={disabledWithTooltip ? preventDisabledInteraction : undefined}
      {...wrapperProps}
    >
      <Tooltip skipWrapper {...tooltipProps} title={tooltipProps?.title}>
        <NativeHiddenCheckbox
          ref={mergeRefs(nativeCheckBoxRef, ref)}
          checked={checked !== 'indeterminate' && checked}
          type="checkbox"
          {...props}
          disabled={disabledWithTooltip ? undefined : props.disabled}
          aria-disabled={disabledWithTooltip || props['aria-disabled']}
          name={disabledWithTooltip ? undefined : props.name}
          required={disabledWithTooltip ? undefined : props.required}
          onChange={disabledWithTooltip ? preventDisabledInteraction : props.onChange}
          onKeyDown={
            disabledWithTooltip
              ? event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    preventDisabledInteraction(event);
                    return;
                  }
                  props.onKeyDown?.(event);
                }
              : props.onKeyDown
          }
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
      {!(props.disabled || props.readOnly) && (
        <InteractionStateLayer
          higherOpacity={checked === true || checked === 'indeterminate'}
        />
      )}
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
