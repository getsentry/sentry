import {useMemo} from 'react';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {getKeyLabel} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import type {AggregateFilter} from 'sentry/components/searchSyntax/parser';

interface UseAggregateParamVisualOptions {
  token: AggregateFilter;
}

export function useAggregateParamVisual({token}: UseAggregateParamVisualOptions) {
  const {filterKeys, getFieldDefinition} = useSearchQueryBuilder();

  return useMemo(() => {
    const aggregateDefinition = getFieldDefinition(token.key.name.text);

    const params =
      token.key.args?.args?.map((arg, i) => {
        const argumentKind = aggregateDefinition?.parameters?.[i]?.kind;

        let argumentText = arg.value?.text ?? '';
        if (argumentKind === 'column') {
          const argumentKey = filterKeys[argumentText];
          if (argumentKey) {
            const argumentDefinition = getFieldDefinition(arg.value?.text ?? '');
            argumentText = getKeyLabel(argumentKey, argumentDefinition);
          }
        }

        return `${arg.separator}${argumentText}`;
      }) ?? [];

    return params.join('');
  }, [token, filterKeys, getFieldDefinition]);
}
