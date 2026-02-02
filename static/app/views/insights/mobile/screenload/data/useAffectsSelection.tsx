import {useQueryState} from 'nuqs';

import type {SelectKey} from '@sentry/scraps/compactSelect';

const DEFAULT_VALUE = 'ALL';

const AffectOptions = ['ALL', 'TTID', 'TTFD', 'NONE'];

export function useAffectsSelection() {
  const [queryState, setQueryState] = useQueryState('affects');
  const isValid = AffectOptions.includes(queryState ?? '');
  const value = (isValid ? queryState : DEFAULT_VALUE) as
    | 'ALL'
    | 'TTID'
    | 'TTFD'
    | 'NONE';

  const setQueryStateWrapper = (newValue: SelectKey) => {
    if (typeof newValue === 'string') {
      setQueryState(newValue);
    }
  };
  return {value, setValue: setQueryStateWrapper};
}
