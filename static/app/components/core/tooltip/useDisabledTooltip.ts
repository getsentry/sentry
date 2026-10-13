import {useCallback} from 'react';

import type {TooltipPropsWithOptionalTitle} from './tooltip';

function preventInteraction(event: React.SyntheticEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

interface DisabledTooltipOptions<Element extends HTMLElement> extends Pick<
  React.HTMLAttributes<Element>,
  'aria-disabled' | 'onKeyDown' | 'onClickCapture' | 'onChange'
> {
  disabled?: boolean;
  tooltipProps?: TooltipPropsWithOptionalTitle;
}

/**
 * Keeps disabled controls focusable when they have a tooltip and prevents activation.
 * Callers still handle exclusion from form submission and validation.
 */
export function useDisabledTooltip<Element extends HTMLElement>({
  disabled,
  tooltipProps,
  onKeyDown,
  onClickCapture,
  onChange,
  'aria-disabled': ariaDisabled,
}: DisabledTooltipOptions<Element>) {
  const disabledWithTooltip = Boolean(
    disabled && tooltipProps?.title && !tooltipProps.disabled
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<Element>) => {
      if (disabledWithTooltip && (event.key === 'Enter' || event.key === ' ')) {
        preventInteraction(event);
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
    onClickCapture: disabled ? preventInteraction : onClickCapture,
    onChange: disabled ? preventInteraction : onChange,
  };
}
