import {useMemo} from 'react';

import {STATIC_SEMVER_TAGS} from 'sentry/components/events/searchBarFieldConstants';
import type {CallbackSearchState} from 'sentry/components/searchQueryBuilder/types';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, type AggregationKey} from 'sentry/utils/fields';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SpanFields} from 'sentry/views/insights/types';

interface SpanSearchQueryBuilderProps {
  initialQuery: string;
  searchSource: string;
  datetime?: PageFilters['datetime'];
  disableLoadingTags?: boolean;
  onBlur?: (query: string, state: CallbackSearchState) => void;
  onSearch?: (query: string, state: CallbackSearchState) => void;
  placeholder?: string;
  projects?: PageFilters['projects'];
  useEap?: boolean;
}

export const getFunctionTags = (supportedAggregates?: AggregationKey[]) => {
  if (!supportedAggregates?.length) {
    return {};
  }

  return supportedAggregates.reduce((acc, item) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    acc[item] = {
      key: item,
      name: item,
      kind: FieldKind.FUNCTION,
    };
    return acc;
  }, {});
};

export function EapSpanSearchQueryBuilderWrapper(props: SpanSearchQueryBuilderProps) {
  const {tags: numberTags, secondaryAliases: numberSecondaryAliases} =
    useTraceItemTags('number');
  const {tags: stringTags, secondaryAliases: stringSecondaryAliases} =
    useTraceItemTags('string');

  return (
    <TraceItemSearchQueryBuilder
      itemType={TraceItemDataset.SPANS}
      numberAttributes={numberTags}
      stringAttributes={stringTags}
      numberSecondaryAliases={numberSecondaryAliases}
      stringSecondaryAliases={stringSecondaryAliases}
      {...props}
    />
  );
}

export interface UseEAPSpanSearchQueryBuilderProps extends SpanSearchQueryBuilderProps {
  autoFocus?: boolean;
  getFilterTokenWarning?: (key: string) => React.ReactNode;
  onChange?: (query: string, state: CallbackSearchState) => void;
  portalTarget?: HTMLElement | null;
  supportedAggregates?: AggregationKey[];
}
export interface EAPSpanSearchQueryBuilderProps
  extends UseEAPSpanSearchQueryBuilderProps {
  itemType: TraceItemDataset;
  numberAttributes: TagCollection;
  numberSecondaryAliases: TagCollection;
  stringAttributes: TagCollection;
  stringSecondaryAliases: TagCollection;
}

export function useEAPSpanSearchQueryBuilderProps(
  props: UseEAPSpanSearchQueryBuilderProps
) {
  const {tags: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemTags('number');
  const {tags: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemTags('string');

  const stringAttributesWithSemver = useMemo(() => {
    if (SpanFields.RELEASE in stringAttributes) {
      return {
        ...stringAttributes,
        ...STATIC_SEMVER_TAGS,
      };
    }
    return stringAttributes;
  }, [stringAttributes]);

  const traceItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps = useMemo(
    () => ({
      itemType: TraceItemDataset.SPANS,
      numberAttributes,
      stringAttributes: stringAttributesWithSemver,
      numberSecondaryAliases,
      stringSecondaryAliases,
      ...props,
    }),
    [
      numberAttributes,
      numberSecondaryAliases,
      props,
      stringAttributesWithSemver,
      stringSecondaryAliases,
    ]
  );

  const searchQueryBuilderProviderProps = useTraceItemSearchQueryBuilderProps({
    itemType: TraceItemDataset.SPANS,
    numberAttributes,
    stringAttributes: stringAttributesWithSemver,
    numberSecondaryAliases,
    stringSecondaryAliases,
    ...props,
  });

  return useMemo(
    () => ({
      searchQueryBuilderProviderProps,
      traceItemSearchQueryBuilderProps,
    }),
    [searchQueryBuilderProviderProps, traceItemSearchQueryBuilderProps]
  );
}
