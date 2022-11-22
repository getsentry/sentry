import {useCallback} from 'react';

import HookStore from 'sentry/stores/hookStore';

type Props = {
  busy?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
};

const useGetHook = () => {
  const useButtonTracking = HookStore.get('react-hook:track-buttons')[0];
  const useButtonClick = ({disabled, busy, onClick}: Props) =>
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
      [disabled, busy, onClick]
    );

  const handleClick = useButtonTracking || useButtonClick;

  return handleClick;
};

export default function useButtonHook({
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
