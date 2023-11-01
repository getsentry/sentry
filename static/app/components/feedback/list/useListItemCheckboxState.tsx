import {useCallback, useState} from 'react';

interface Props {
  hits: number;
  knownIds: string[];
}

type State = {all: true} | {ids: Set<string>};

interface Return {
  checkAll: () => void;
  isChecked: (id: string) => boolean;
  state: State & {total: number};
  toggleChecked: (id: string) => void;
  uncheckAll: () => void;
}

export default function useListItemCheckboxState({hits, knownIds}: Props): Return {
  const [state, setState] = useState<State>({ids: new Set()});

  const toggleChecked = useCallback((id: string) => {
    setState(prev => {
      if ('ids' in prev) {
        if (prev.ids.has(id)) {
          prev.ids.delete(id);
        } else {
          prev.ids.add(id);
        }
        return {...prev};
      }
      if ('all' in prev) {
        // do nothing, user needs to unset {all: true} first
      }
      return prev;
    });
  }, []);

  const checkAll = useCallback(() => {
    if (hits === knownIds.length) {
      setState({ids: new Set(knownIds)});
    } else {
      setState({all: true});
    }
  }, [hits, knownIds]);

  const uncheckAll = useCallback(() => {
    setState({ids: new Set()});
  }, []);

  const isChecked = useCallback(
    (id: string) => ('all' in state ? true : state.ids.has(id) === true),
    [state]
  );

  return {
    checkAll,
    isChecked,
    state: {...state, total: hits},
    toggleChecked,
    uncheckAll,
  };
}
