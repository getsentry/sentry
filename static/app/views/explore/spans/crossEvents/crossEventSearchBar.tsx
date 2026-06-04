import {memo, useMemo} from 'react';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  type AggregationKey,
} from 'sentry/utils/fields';
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
import {SamplesModeAggregateFilterWarning} from 'sentry/views/explore/spans/samplesModeAggregateFilterWarning';
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
          if (!crossEvents) {
            return;
          }

          setCrossEvents?.(
            crossEvents.map((c, i) => {
              if (i === index) {
                return {query: newQuery, type};
              }
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
                  return <SamplesModeAggregateFilterWarning />;
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
        replaceRawSearchKeys: type === 'logs' ? ['message'] : ['span.description'],
      }),
      [
        booleanAttributes,
        booleanSecondaryAliases,
        crossEvents,
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
