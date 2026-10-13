import {useCallback} from 'react';

import type {ControlTooltipProps} from './tooltip';

interface DisabledTooltipOptions<Element extends HTMLElement> extends Pick<
  React.HTMLAttributes<Element>,
  'aria-disabled' | 'onKeyDown'
> {
  disabled?: boolean;
  tooltipProps?: ControlTooltipProps;
}

/**
 * Keeps disabled controls focusable and prevents keyboard activation when they have a tooltip.
 * Callers still handle pointer activation and exclusion from form submission and validation.
 */
export function useDisabledTooltip<Element extends HTMLElement>({
  disabled,
  tooltipProps,
  onKeyDown,
  'aria-disabled': ariaDisabled,
}: DisabledTooltipOptions<Element>) {
  const disabledWithTooltip = Boolean(
    disabled && tooltipProps?.title && !tooltipProps.disabled
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<Element>) => {
      if (disabledWithTooltip && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onKeyDown?.(event);
    },
    [disabledWithTooltip, onKeyDown]
  );

  return {
    disabled: disabledWithTooltip ? undefined : disabled,
    'aria-disabled': disabledWithTooltip || ariaDisabled,
    onKeyDown: handleKeyDown,
  };
}
