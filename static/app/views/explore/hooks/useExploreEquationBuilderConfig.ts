import {useCallback, useMemo} from 'react';

import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import type {TagCollection} from 'sentry/types/group';
import type {FieldDefinition} from 'sentry/utils/fields';
import {
  FieldKind,
  getExploreEquationAggregates,
  getExploreEquationFieldDefinition,
} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useExploreSuggestedAttribute} from 'sentry/views/explore/hooks/useExploreSuggestedAttribute';
import {useGetTraceItemAttributeValues} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import type {TraceItemDataset} from 'sentry/views/explore/types';

function traceItemTagsToFunctionArguments(
  numberTags: TagCollection,
  stringTags: TagCollection,
  booleanTags: TagCollection
): FunctionArgument[] {
  return [
    ...Object.entries(numberTags).map(([key, tag]) => ({
      kind: FieldKind.MEASUREMENT,
      name: key,
      label: tag.name,
    })),
    ...Object.entries(stringTags).map(([key, tag]) => ({
      kind: FieldKind.TAG,
      name: key,
      label: tag.name,
    })),
    ...Object.entries(booleanTags).map(([key, tag]) => ({
      kind: FieldKind.BOOLEAN,
      name: key,
      label: tag.name,
    })),
  ];
}

interface UseExploreEquationBuilderConfigOptions {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  stringTags: TagCollection;
  traceItemType: TraceItemDataset;
}

interface ExploreEquationBuilderConfig {
  aggregations: string[];
  functionArguments: FunctionArgument[];
  getFieldDefinition: (
    key: string,
    attributeTexts?: readonly string[]
  ) => FieldDefinition | null;
  getFilterTagValues: GetTagValues;
  getSuggestedKey: (key: string) => string | null;
}

export function useExploreEquationBuilderConfig({
  traceItemType,
  numberTags,
  stringTags,
  booleanTags,
}: UseExploreEquationBuilderConfigOptions): ExploreEquationBuilderConfig {
  const organization = useOrganization();
  const hasConditionalAggregates = organization.features.includes(
    'explore-conditional-aggregates'
  );

  const aggregations = useMemo(
    () => getExploreEquationAggregates(hasConditionalAggregates),
    [hasConditionalAggregates]
  );

  const functionArguments = useMemo(
    () => traceItemTagsToFunctionArguments(numberTags, stringTags, booleanTags),
    [booleanTags, numberTags, stringTags]
  );

  const getFieldDefinition = useCallback(
    (key: string, attributeTexts?: readonly string[]) => {
      const tag = numberTags[key] ?? stringTags[key] ?? booleanTags[key];
      return getExploreEquationFieldDefinition(
        key,
        tag?.kind,
        hasConditionalAggregates,
        attributeTexts
      );
    },
    [booleanTags, hasConditionalAggregates, numberTags, stringTags]
  );

  const getSuggestedKey = useExploreSuggestedAttribute({
    numberAttributes: numberTags,
    stringAttributes: stringTags,
    booleanAttributes: booleanTags,
  });

  const getFilterTagValues = useGetTraceItemAttributeValues({
    traceItemType,
    type: 'string',
  });

  return {
    aggregations,
    functionArguments,
    getFieldDefinition,
    getSuggestedKey,
    getFilterTagValues,
  };
}
