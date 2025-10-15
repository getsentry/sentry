import {useMemo, useState} from 'react';

import {useCommandPaletteStore} from 'sentry/components/commandPalette/context';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';

export function useCommandPaletteState() {
  const {actionsRef} = useCommandPaletteStore();
  const [selectedAction, setSelectedAction] = useState<CommandPaletteAction | null>(null);

  const displayedActions = useMemo(() => {
    if (selectedAction?.children?.length) {
      return selectedAction.children?.filter(action => !action.hidden);
    }

    return actionsRef.current;
  }, [selectedAction?.children, actionsRef]);

  return {
    actions: displayedActions,
    selectedAction,
    selectAction: setSelectedAction,
    clearSelection: () => {
      setSelectedAction(null);
    },
  };
}
