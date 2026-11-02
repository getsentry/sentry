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

    const params =
      token.key.args?.args?.map((arg, i) => {
        const parameterDefinition = aggregateDefinition?.parameters?.[i];

        let argumentText = arg.value?.text ?? '';
        if (
          parameterDefinition?.kind === 'column' &&
          parameterDefinition.defaultLabel &&
          argumentText === parameterDefinition.defaultValue
        ) {
          argumentText = parameterDefinition.defaultLabel;
        } else if (parameterDefinition?.kind === 'column') {
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
