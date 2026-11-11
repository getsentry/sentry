import type * as React from 'react';
import {useCallback} from 'react';

import type {TooltipProps} from './tooltip';

interface DisabledTooltipOptions<Element extends HTMLElement> extends Pick<
  React.HTMLAttributes<Element>,
  'aria-disabled' | 'onKeyDown'
> {
  disabled?: boolean;
  tooltipProps?: Pick<TooltipProps, 'title' | 'disabled'>;
}

/**
 * Keeps disabled controls focusable when they have a tooltip and prevents keyboard activation.
 *
 * `aria-disabled` does not stop native behavior, so when `isFocusableDisabled` is true
 * callers must also block any other interaction their element supports (for example
 * click/change events and form participation for inputs).
 */
export function useDisabledTooltip<Element extends HTMLElement>({
  disabled,
  tooltipProps,
  onKeyDown,
  'aria-disabled': ariaDisabled,
}: DisabledTooltipOptions<Element>) {
  const isFocusableDisabled = Boolean(
    disabled && tooltipProps?.title && !tooltipProps.disabled
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<Element>) => {
      if (isFocusableDisabled && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onKeyDown?.(event);
    },
    [isFocusableDisabled, onKeyDown]
  );

  return {
    isFocusableDisabled,
    disabledProps: {
      disabled: isFocusableDisabled ? undefined : disabled,
      'aria-disabled': isFocusableDisabled || ariaDisabled,
      onKeyDown: handleKeyDown,
    },
  };
}
