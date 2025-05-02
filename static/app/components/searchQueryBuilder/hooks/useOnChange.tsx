import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import usePrevious from 'sentry/utils/usePrevious';

export function useOnChange() {
  const {committedQuery, handleOnChange} = useSearchQueryBuilder();

  const previousCommittedQuery = usePrevious(committedQuery);

  useEffectAfterFirstRender(() => {
    if (committedQuery !== previousCommittedQuery) {
      handleOnChange(committedQuery);
    }
  }, [committedQuery, previousCommittedQuery, handleOnChange]);
}
