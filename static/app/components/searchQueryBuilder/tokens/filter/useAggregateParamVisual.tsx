import {useMemo} from 'react';

import {useSearchQueryBuilderConfig} from 'sentry/components/searchQueryBuilder/context';
import {getKeyLabel} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/getKeyLabel';
import type {AggregateFilter} from 'sentry/components/searchSyntax/parser';

interface UseAggregateParamVisualOptions {
  token: AggregateFilter;
}

export function useAggregateParamVisual({token}: UseAggregateParamVisualOptions) {
  const {filterKeys, getFieldDefinition} = useSearchQueryBuilderConfig();

  return useMemo(() => {
    const aggregateDefinition = getFieldDefinition(token.key.name.text);
    // Saved queries can carry an argument the function no longer takes, such as
    // `count(span.duration)`; render those as `count()`.
    if (aggregateDefinition?.parameters?.length === 0) {
      return '';
    }

    const params =
      token.key.args?.args?.map((arg, i) => {
        const argumentKind = aggregateDefinition?.parameters?.[i]?.kind;

        let argumentText = arg.value?.text ?? '';
        if (argumentKind === 'column') {
          const argumentKey = Object.hasOwn(filterKeys, argumentText)
            ? filterKeys[argumentText]
            : undefined;
          if (argumentKey) {
            const argumentDefinition = getFieldDefinition(argumentText);
            argumentText = getKeyLabel(argumentKey, argumentDefinition);
          }
        }

        return `${arg.separator}${argumentText}`;
      }) ?? [];

    return params.join('');
  }, [token, filterKeys, getFieldDefinition]);
}
