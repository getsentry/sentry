import {useCallback} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

export function useControlSectionExpanded(localStorageKey: string) {
  const [controlSectionExpanded, _setControlSectionExpanded] = useLocalStorageState(
    localStorageKey,
    'expanded'
  );

  const setControlSectionExpanded = useCallback(
    (expanded: boolean) => {
      _setControlSectionExpanded(expanded ? 'expanded' : '');
    },
    [_setControlSectionExpanded]
  );

  return [controlSectionExpanded === 'expanded', setControlSectionExpanded] as const;
}
