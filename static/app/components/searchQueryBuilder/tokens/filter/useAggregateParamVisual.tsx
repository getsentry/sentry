import {useMemo} from 'react';

import {useSearchQueryBuilderConfig} from 'sentry/components/searchQueryBuilder/context';
import {getKeyLabel} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/getKeyLabel';
import type {AggregateFilter} from 'sentry/components/searchSyntax/parser';

import {
  getAggregateArgTexts,
  getConditionalAggregateArgumentLabel,
  hasSearchFilterParameter,
} from './utils';

interface UseAggregateParamVisualOptions {
  token: AggregateFilter;
}

export function useAggregateParamVisual({token}: UseAggregateParamVisualOptions) {
  const {filterKeys, getFieldDefinition} = useSearchQueryBuilderConfig();

  return useMemo(() => {
    const aggregateDefinition = getFieldDefinition(token.key.name.text, {
      aggregateArgs: getAggregateArgTexts(token),
    });

    const isConditional = hasSearchFilterParameter(aggregateDefinition);

    const params =
      token.key.args?.args?.map((arg, i) => {
        const parameter = aggregateDefinition?.parameters?.[i];
        const rawText = arg.value?.text ?? '';

        if (isConditional) {
          const label = getConditionalAggregateArgumentLabel(parameter, rawText);
          if (label !== rawText) {
            return `${arg.separator}${label}`;
          }
        }

        let argumentText = rawText;
        if (parameter?.kind === 'column') {
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
