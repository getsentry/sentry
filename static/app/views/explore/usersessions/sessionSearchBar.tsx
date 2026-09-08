import {useCallback, useMemo} from 'react';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  SearchQueryBuilder,
  type GetTagValuesParams,
  type TagValueWithCount,
} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {useTraceItemSearchQueryBuilderProps} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useGetTraceItemAttributeValues} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {SESSION_DATASETS} from './datasets';
import type {SessionAttributes} from './useSessionAttributes';

/** Per value-autocomplete request, across all datasets. */
const MAX_TAG_VALUES = 100;

/** Stable identity — an inline `{}` would bust the props memo every render. */
const NO_ALIASES: TagCollection = {};

interface Props {
  attributes: SessionAttributes;
  onSearch: (query: string) => void;
  query: string;
}

/**
 * Search bar for the session list.
 *
 * A session is not a row in any one dataset, so this searches over the union of
 * every dataset's attributes rather than one namespace. Key autocomplete offers
 * that union, and value autocomplete fans out to just the datasets that actually
 * carry the key being completed.
 */
export function SessionSearchBar({attributes, query, onSearch}: Props) {
  const {stringAttributes, numberAttributes, booleanAttributes, secondaryAliases} =
    attributes;

  const getTagValues = useSessionAttributeValues(attributes);
  const filterKeySections = useSessionFilterKeySections(attributes);

  const searchQueryBuilderProps = useTraceItemSearchQueryBuilderProps({
    // Spans drive the static field definitions; keys from the other datasets fall
    // back to the kind recorded in the merged attribute collections.
    itemType: TraceItemDataset.SPANS,
    initialQuery: query,
    onSearch,
    searchSource: 'explore.usersessions',
    // Spans rather than traces: a query is matched against individual telemetry
    // items to *find* sessions, and any span in a trace counts — not just the
    // segment span the trace's row is drawn from.
    placeholder: t('Search for spans, logs, metrics, errors, users, tags, and more'),
    stringAttributes,
    numberAttributes,
    booleanAttributes,
    stringSecondaryAliases: secondaryAliases,
    numberSecondaryAliases: NO_ALIASES,
    booleanSecondaryAliases: NO_ALIASES,
    // No SavedSearchType covers this page; reusing the spans one would pollute the
    // spans tab's history.
    disableRecentSearches: true,
  });

  return (
    <SearchQueryBuilder
      {...searchQueryBuilderProps}
      filterKeySections={filterKeySections}
      getTagValues={getTagValues}
    />
  );
}

/**
 * Value autocomplete over every dataset that knows the key. Without this, values
 * for a log- or error-only attribute would silently come back empty.
 */
function useSessionAttributeValues({knownKeys}: SessionAttributes) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const getSpanValues = useGetTraceItemAttributeValues({
    traceItemType: TraceItemDataset.SPANS,
    type: 'string',
  });
  const getLogValues = useGetTraceItemAttributeValues({
    traceItemType: TraceItemDataset.LOGS,
    type: 'string',
  });
  const getMetricValues = useGetTraceItemAttributeValues({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'string',
  });

  const getErrorValues = useCallback(
    async ({tag, searchQuery}: GetTagValuesParams): Promise<TagValueWithCount[]> => {
      const values = await fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: tag.key,
        dataset: Dataset.ERRORS,
        projectIds: selection.projects.map(String),
        endpointParams: normalizeDateTimeParams(selection.datetime),
        search: searchQuery,
        sort: '-count',
      });
      return values.map(value => ({value: value.value, count: value.count}));
    },
    [api, organization.slug, selection.datetime, selection.projects]
  );

  return useCallback(
    async (params: GetTagValuesParams): Promise<TagValueWithCount[]> => {
      const {tag} = params;
      if (tag.kind === FieldKind.FUNCTION) {
        return [];
      }

      const sources = [
        knownKeys.traces.has(tag.key) ? getSpanValues : undefined,
        knownKeys.logs.has(tag.key) ? getLogValues : undefined,
        knownKeys.metrics.has(tag.key) ? getMetricValues : undefined,
        knownKeys.errors.has(tag.key) ? getErrorValues : undefined,
      ].filter(source => source !== undefined);

      // One dataset failing or not carrying the key must not blank the whole
      // suggestion list.
      const results = await Promise.all(
        sources.map(source => Promise.resolve(source(params)).catch(() => []))
      );

      const byValue = new Map<string, TagValueWithCount>();
      results.flat().forEach(entry => {
        const value = typeof entry === 'string' ? entry : entry.value;
        const count = typeof entry === 'string' ? undefined : entry.count;
        const existing = byValue.get(value);
        if (existing) {
          // Same value seen in two datasets: the session-wide count is the sum.
          existing.count =
            existing.count === undefined && count === undefined
              ? undefined
              : (existing.count ?? 0) + (count ?? 0);
          return;
        }
        byValue.set(value, {value, count});
      });

      return Array.from(byValue.values())
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, MAX_TAG_VALUES);
    },
    [getErrorValues, getLogValues, getMetricValues, getSpanValues, knownKeys]
  );
}

/**
 * Groups the key menu by telemetry type. A key that several datasets carry (eg.
 * `user.id`) appears under each of them, which is the honest answer — it really
 * is searchable on all of them.
 */
function useSessionFilterKeySections({
  knownKeys,
  stringAttributes,
  numberAttributes,
  booleanAttributes,
}: SessionAttributes): FilterKeySection[] {
  return useMemo(() => {
    const searchable = new Set([
      ...Object.keys(stringAttributes),
      ...Object.keys(numberAttributes),
      ...Object.keys(booleanAttributes),
    ]);

    return SESSION_DATASETS.map(config => ({
      value: config.key,
      label: config.label,
      children: Array.from(knownKeys[config.key]).filter(key => searchable.has(key)),
    })).filter(section => section.children.length > 0);
  }, [booleanAttributes, knownKeys, numberAttributes, stringAttributes]);
}
