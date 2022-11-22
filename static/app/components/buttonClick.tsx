import {useCallback} from 'react';

import HookStore from 'sentry/stores/hookStore';

const useGetHook = ({disabled, busy, onClick}) => {
  const useButtonTracking = HookStore.get('react-hook:track-buttons')[0];
  const useButtonClick = () =>
    useCallback((e: React.MouseEvent) => {
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
    }, []);

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
}) {
  const useHook = useGetHook({
    disabled,
    busy,
    onClick,
  });

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
