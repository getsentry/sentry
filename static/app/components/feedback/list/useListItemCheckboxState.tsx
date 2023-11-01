import {useCallback, useMemo, useState} from 'react';

export default function useListItemCheckboxState() {
  const [state, setState] = useState<Record<string, boolean>>({});

  const checked = useMemo(() => {
    const isChecked = (feedbackId: string) => state[feedbackId];

    const feedbackIds = Object.keys(state);
    return feedbackIds.filter(isChecked);
  }, [state]);

  const toggleChecked = useCallback((id: string) => {
    setState(prev => {
      prev[id] = !prev[id];
      return {...prev};
    });
  }, []);

  const uncheckAll = useCallback(() => {
    setState({});
  }, []);

  return {
    checked,
    toggleChecked,
    uncheckAll,
  };
}
