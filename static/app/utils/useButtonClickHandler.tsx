import {useCallback} from 'react';

import {ButtonProps} from 'sentry/components/button';
import HookStore from 'sentry/stores/hookStore';

type Props = ButtonProps;

/**
 * Gets the correct hook and initializes it. The Hook for analytics needs to be called to return
 * the React hook so the default hook is also nested in a call. Should not be used outside of button.tsx
 */
export default function useButtonClickHandler({
  disabled,
  busy,
  onClick,
  ...buttonProps
}: Props) {
  const buttonTracking = HookStore.get('analytics:track-button-clicks')[0];

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't allow clicks when disabled or busy
      if (disabled || busy) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      buttonTracking?.(buttonProps);

      if (typeof onClick !== 'function') {
        return;
      }

      onClick(e);
    },
    [disabled, busy, onClick, buttonProps, buttonTracking]
  );

  return handleClick;
}
