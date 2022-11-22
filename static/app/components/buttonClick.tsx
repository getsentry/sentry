import {useCallback} from 'react';

import {ButtonProps} from 'sentry/components/button';
import HookStore from 'sentry/stores/hookStore';

type Props = ButtonProps;

const useGetHook = () => {
  const useButtonTracking = HookStore.get('react-hook:track-buttons')[0];
  const useButtonClick = (
    busy: boolean,
    disabled: boolean,
    onClick: (e: React.MouseEvent) => void
  ) => {
    useCallback(
      (e: React.MouseEvent) => {
        // Don't allow clicks when disabled or busy
        if (disabled || busy) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (typeof onClick !== 'function') {
          return;
        }

        onClick(e);
      },
      [busy, disabled, onClick]
    );
  };
  const handleClick = useButtonTracking || useButtonClick;

  return handleClick;
};

export function useButtonHook({
  disabled,
  busy,
  onClick,
  analyticsEventName,
  analyticsEventKey,
  'aria-label': ariaLabel,
  priority,
  href,
  analyticsParams,
}: Props) {
  const useHook = useGetHook();

  const useClick = useHook({
    disabled,
    busy,
    onClick,
    analyticsEventName,
    analyticsEventKey,
    'aria-label': ariaLabel || '',
    analyticsParams: {priority, href, ...analyticsParams},
  });
  return useClick;
}
