import {memo, useMemo} from 'react';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  type AggregationKey,
} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceItemDatasetAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {
  useQueryParamsCrossEvents,
  useQueryParamsMode,
  useSetQueryParamsCrossEvents,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface SpansTabCrossEventSearchBarProps {
  index: number;
  query: string;
  type: 'logs' | 'spans';
}

export const SpansTabCrossEventSearchBar = memo(
  ({index, query, type}: SpansTabCrossEventSearchBarProps) => {
    const mode = useQueryParamsMode();
    const crossEvents = useQueryParamsCrossEvents();
    const setCrossEvents = useSetQueryParamsCrossEvents();
    const organization = useOrganization();
    const hasRawSearchReplacement = organization.features.includes(
      'search-query-builder-raw-search-replacement'
    );

    const traceItemType =
      type === 'logs' ? TraceItemDataset.LOGS : TraceItemDataset.SPANS;

    const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
      useTraceItemDatasetAttributes(traceItemType, {}, 'number');
    const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
      useTraceItemDatasetAttributes(traceItemType, {}, 'string');
    const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
      useTraceItemDatasetAttributes(traceItemType, {}, 'boolean');

    const eapSpanSearchQueryBuilderProps = useMemo(
      () => ({
        initialQuery: query,
        onSearch: (newQuery: string) => {
          if (!crossEvents) return;

          setCrossEvents?.(
            crossEvents.map((c, i) => {
              if (i === index) return {query: newQuery, type};
              return c;
            })
          );
        },
        searchSource: 'explore',
        getFilterTokenWarning:
          mode === Mode.SAMPLES
            ? (key: string) => {
                if (
                  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.includes(key as AggregationKey)
                ) {
                  return t(
                    "This key won't affect the results because samples mode does not support aggregate functions"
                  );
                }
                return;
              }
            : undefined,
        supportedAggregates:
          mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
        booleanAttributes,
        numberAttributes,
        stringAttributes,
        matchKeySuggestions: [
          {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
          {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
        ],
        booleanSecondaryAliases,
        numberSecondaryAliases,
        stringSecondaryAliases,
        replaceRawSearchKeys: hasRawSearchReplacement
          ? type === 'logs'
            ? ['message']
            : ['span.description']
          : undefined,
      }),
      [
        booleanAttributes,
        booleanSecondaryAliases,
        crossEvents,
        hasRawSearchReplacement,
        index,
        mode,
        numberSecondaryAliases,
        numberAttributes,
        query,
        setCrossEvents,
        stringSecondaryAliases,
        stringAttributes,
        type,
      ]
    );

    const searchQueryBuilderProps = useTraceItemSearchQueryBuilderProps({
      itemType: traceItemType,
      ...eapSpanSearchQueryBuilderProps,
    });

    return (
      <SearchQueryBuilderProvider {...searchQueryBuilderProps}>
        <TraceItemSearchQueryBuilder
          itemType={traceItemType}
          {...eapSpanSearchQueryBuilderProps}
        />
      </SearchQueryBuilderProvider>
    );
  }
);
