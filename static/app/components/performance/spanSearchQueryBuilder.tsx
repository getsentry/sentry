import {useMemo} from 'react';

import {STATIC_SEMVER_TAGS} from 'sentry/components/events/searchBarFieldConstants';
import type {SearchQueryBuilderProps} from 'sentry/components/searchQueryBuilder';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {CallbackSearchState} from 'sentry/components/searchQueryBuilder/types';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, type AggregationKey} from 'sentry/utils/fields';
import {
  useTraceItemSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SpanFields} from 'sentry/views/insights/types';

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

  const spanSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps = useMemo(
    () => ({
      ...props,
      itemType: TraceItemDataset.SPANS,
      numberAttributes,
      stringAttributes: stringAttributesWithSemver,
      numberSecondaryAliases,
      stringSecondaryAliases,
      caseInsensitive: props.caseInsensitive ? true : undefined,
    }),
    [
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
