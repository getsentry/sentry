import {useMemo} from 'react';

import {STATIC_SEMVER_TAGS} from 'sentry/components/events/searchBarFieldConstants';
import type {SearchQueryBuilderProps} from 'sentry/components/searchQueryBuilder';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {CallbackSearchState} from 'sentry/components/searchQueryBuilder/types';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import {type AggregationKey} from 'sentry/utils/fields';
import {
  useTraceItemSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SpanFields} from 'sentry/views/insights/types';

export interface UseSpanSearchQueryBuilderProps {
  initialQuery: string;
  searchSource: string;
  autoFocus?: boolean;
  caseInsensitive?: CaseInsensitive;
  datetime?: PageFilters['datetime'];
  disableLoadingTags?: boolean;
  getFilterTokenWarning?: (key: string) => React.ReactNode;
  onBlur?: (query: string, state: CallbackSearchState) => void;
  onCaseInsensitiveClick?: SearchQueryBuilderProps['onCaseInsensitiveClick'];
  onChange?: (query: string, state: CallbackSearchState) => void;
  onSearch?: (query: string, state: CallbackSearchState) => void;
  placeholder?: string;
  portalTarget?: HTMLElement | null;
  projects?: PageFilters['projects'];
  supportedAggregates?: AggregationKey[];
  useEap?: boolean;
}
export interface SpanSearchQueryBuilderProps extends UseSpanSearchQueryBuilderProps {
  booleanAttributes: TagCollection;
  booleanSecondaryAliases: TagCollection;
  itemType: TraceItemDataset;
  numberAttributes: TagCollection;
  numberSecondaryAliases: TagCollection;
  stringAttributes: TagCollection;
  stringSecondaryAliases: TagCollection;
}

type UseTraceItemSearchQueryBuilderPropsReturnType = ReturnType<
  typeof useTraceItemSearchQueryBuilderProps
>;

export function useSpanSearchQueryBuilderProps(props: UseSpanSearchQueryBuilderProps): {
  spanSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps;
  spanSearchQueryBuilderProviderProps: UseTraceItemSearchQueryBuilderPropsReturnType;
} {
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useSpanItemAttributes({}, 'number');
  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useSpanItemAttributes({}, 'boolean');

  const stringAttributesWithSemver = useMemo(() => {
    if (SpanFields.RELEASE in stringAttributes) {
      return {
        ...stringAttributes,
        ...STATIC_SEMVER_TAGS,
      };
    }
    return stringAttributes;
  }, [stringAttributes]);

  const spanSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps = useMemo(
    () => ({
      ...props,
      itemType: TraceItemDataset.SPANS,
      booleanAttributes,
      booleanSecondaryAliases,
      numberAttributes,
      stringAttributes: stringAttributesWithSemver,
      numberSecondaryAliases,
      stringSecondaryAliases,
      caseInsensitive: props.caseInsensitive ? true : undefined,
    }),
    [
      booleanAttributes,
      booleanSecondaryAliases,
      numberAttributes,
      numberSecondaryAliases,
      props,
      stringAttributesWithSemver,
      stringSecondaryAliases,
    ]
  );

  const spanSearchQueryBuilderProviderProps = useTraceItemSearchQueryBuilderProps({
    ...props,
    itemType: TraceItemDataset.SPANS,
    booleanAttributes,
    booleanSecondaryAliases,
    numberAttributes,
    stringAttributes: stringAttributesWithSemver,
    numberSecondaryAliases,
    stringSecondaryAliases,
    caseInsensitive: props.caseInsensitive ? true : undefined,
    onCaseInsensitiveClick: props.onCaseInsensitiveClick,
  });

  return useMemo(
    () => ({
      spanSearchQueryBuilderProps,
      spanSearchQueryBuilderProviderProps,
    }),
    [spanSearchQueryBuilderProps, spanSearchQueryBuilderProviderProps]
  );
}
