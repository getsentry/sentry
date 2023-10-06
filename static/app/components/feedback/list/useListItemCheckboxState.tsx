import {useCallback, useMemo, useState} from 'react';

export default function useListItemCheckboxState() {
  const [state, setState] = useState<Record<string, boolean>>({});

  const checked = useMemo(() => Object.keys(state).filter(key => state[key]), [state]);

  const toggleChecked = useCallback((id: string) => {
    setState(prev => {
      prev[id] = !prev[id];
      return {...prev};
    });
  }, []);

  return {
    checked,
    toggleChecked,
  };
}
