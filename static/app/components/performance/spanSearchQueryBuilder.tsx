import {useMemo} from 'react';

import {STATIC_SEMVER_TAGS} from 'sentry/components/events/searchBarFieldConstants';
import type {SearchQueryBuilderProps} from 'sentry/components/searchQueryBuilder';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {CallbackSearchState} from 'sentry/components/searchQueryBuilder/types';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, type AggregationKey} from 'sentry/utils/fields';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {
  useTraceItemSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';
import {SpanFields} from 'sentry/views/insights/types';

export interface UseSpanSearchQueryBuilderProps {
  initialQuery: string;
  searchSource: string;
  autoFocus?: boolean;
  caseInsensitive?: CaseInsensitive;
  datetime?: PageFilters['datetime'];
  defaultToAskSeerOnFreeTextSearch?: SearchQueryBuilderProps['defaultToAskSeerOnFreeTextSearch'];
  disableLoadingTags?: boolean;
  disallowNegation?: boolean;
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
  validatedSearchQueryData?: EventValidationData;
}
export interface SpanSearchQueryBuilderProps extends UseSpanSearchQueryBuilderProps {
  booleanAttributes: TagCollection;
  booleanSecondaryAliases: TagCollection;
  itemType: TraceItemDataset;
  numberAttributes: TagCollection;
  numberSecondaryAliases: TagCollection;
  stringAttributes: TagCollection;
  stringSecondaryAliases: TagCollection;
  arrayAttributes?: TagCollection;
  arraySecondaryAliases?: TagCollection;
}

type UseTraceItemSearchQueryBuilderPropsReturnType = ReturnType<
  typeof useTraceItemSearchQueryBuilderProps
>;

export function useSpanSearchQueryBuilderProps(props: UseSpanSearchQueryBuilderProps): {
  spanSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps;
  spanSearchQueryBuilderProviderProps: UseTraceItemSearchQueryBuilderPropsReturnType;
} {
  const {attributes: spanBooleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useSpanItemAttributes({}, 'boolean');
  const {attributes: spanNumberAttributes, secondaryAliases: numberSecondaryAliases} =
    useSpanItemAttributes({}, 'number');
  const {attributes: spanStringAttributes, secondaryAliases: stringSecondaryAliases} =
    useSpanItemAttributes({}, 'string');
  const {attributes: spansArrayAttributes, secondaryAliases: arraySecondaryAliases} =
    useSpanItemAttributes({}, 'array');

  const spanStringAttributesWithSemver = useMemo(() => {
    if (SpanFields.RELEASE in spanStringAttributes) {
      return {
        ...spanStringAttributes,
        ...STATIC_SEMVER_TAGS,
      };
    }
    return spanStringAttributes;
  }, [spanStringAttributes]);

  const {
    booleanAttributes,
    numberAttributes,
    stringAttributes,
    arrayAttributes,
    invalidFilterKeys,
  } = useMemo(() => {
    const localInvalidFilterKeys: string[] = [];
    const localBooleanAttributes = {...spanBooleanAttributes};
    const localNumberAttributes = {...spanNumberAttributes};
    const localStringAttributes = {...spanStringAttributesWithSemver};
    const localArrayAttributes = {...spansArrayAttributes};

    if (props.validatedSearchQueryData?.query.fields.length) {
      for (const item of props.validatedSearchQueryData.query.fields) {
        if (item.valid) {
          if (item.attrType === 'boolean' && item.name) {
            localBooleanAttributes[item.name] ??= {
              key: item.name,
              name: prettifyAttributeName(item.name),
              kind: FieldKind.BOOLEAN,
            };
          }

          if (item.attrType === 'number' && item.name) {
            localNumberAttributes[item.name] ??= {
              key: item.name,
              name: prettifyAttributeName(item.name),
              kind: FieldKind.MEASUREMENT,
            };
          }

          if (item.attrType === 'string' && item.name) {
            localStringAttributes[item.name] ??= {
              key: item.name,
              name: prettifyAttributeName(item.name),
              kind: FieldKind.TAG,
            };
          }

          if (item.attrType === 'array' && item.name) {
            localArrayAttributes[item.name] ??= {
              key: item.name,
              name: prettifyAttributeName(item.name),
              kind: FieldKind.ARRAY,
            };
          }

          continue;
        }

        if (item.name) {
          localInvalidFilterKeys.push(item.name);
        }
      }
    }

    return {
      booleanAttributes: localBooleanAttributes,
      numberAttributes: localNumberAttributes,
      stringAttributes: localStringAttributes,
      arrayAttributes: localArrayAttributes,
      invalidFilterKeys: localInvalidFilterKeys,
    };
  }, [
    props.validatedSearchQueryData?.query.fields,
    spanBooleanAttributes,
    spanNumberAttributes,
    spanStringAttributesWithSemver,
    spansArrayAttributes,
  ]);

  const spanSearchQueryBuilderProviderProps = useTraceItemSearchQueryBuilderProps({
    ...props,
    itemType: TraceItemDataset.SPANS,
    booleanAttributes,
    booleanSecondaryAliases,
    numberAttributes,
    stringAttributes,
    arrayAttributes,
    numberSecondaryAliases,
    stringSecondaryAliases,
    arraySecondaryAliases,
    caseInsensitive: props.caseInsensitive ? true : undefined,
    onCaseInsensitiveClick: props.onCaseInsensitiveClick,
    invalidFilterKeys,
  });

  const spanSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps = {
    ...props,
    itemType: TraceItemDataset.SPANS,
    booleanAttributes,
    booleanSecondaryAliases,
    numberAttributes,
    stringAttributes,
    arrayAttributes,
    numberSecondaryAliases,
    stringSecondaryAliases,
    arraySecondaryAliases,
    caseInsensitive: props.caseInsensitive ? true : undefined,
    invalidFilterKeys,
  };

  return {
    spanSearchQueryBuilderProps,
    spanSearchQueryBuilderProviderProps,
  };
}
