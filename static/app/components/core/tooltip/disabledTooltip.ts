import type {TooltipProps} from './tooltip';

export interface ControlTooltipProps extends Omit<
  TooltipProps,
  'children' | 'skipWrapper' | 'title'
> {
  title?: TooltipProps['title'];
}

type DisabledTooltipOptions<Element extends HTMLElement> = {
  disabled: boolean | undefined;
  onKeyDown: React.KeyboardEventHandler<Element> | undefined;
  tooltipTitle: React.ReactNode;
};

/**
 * Keeps disabled controls with explanatory tooltips focusable while preserving
 * native disabled behavior for controls without a tooltip.
 */
export function getDisabledTooltipProps<Element extends HTMLElement>({
  disabled,
  onKeyDown,
  tooltipTitle,
}: DisabledTooltipOptions<Element>) {
  const usesAriaDisabled = Boolean(disabled && tooltipTitle);

  return {
    disabled: usesAriaDisabled ? undefined : disabled,
    ...(disabled !== undefined && {'aria-disabled': disabled}),
    ...(usesAriaDisabled && {
      onKeyDown: (event: React.KeyboardEvent<Element>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
        }
        onKeyDown?.(event);
      },
    }),
  };
}
