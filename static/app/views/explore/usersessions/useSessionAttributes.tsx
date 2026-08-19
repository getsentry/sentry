import {useMemo} from 'react';

import {useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import {STATIC_FIELD_TAGS_WITHOUT_TRANSACTION_FIELDS} from 'sentry/components/events/searchBarFieldConstants';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {useTraceItemDatasetAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {TraceItemDataset} from 'sentry/views/explore/types';

import type {KnownKeysByDataset} from './queryRouting';

/**
 * Fields the events endpoint accepts on the `errors` dataset, already kinded.
 * This is the same collection Discover uses for its errors dataset
 * (`views/discover/results/resultsSearchQueryBuilder.tsx`).
 */
const ERROR_FIELD_TAGS =
  STATIC_FIELD_TAGS_WITHOUT_TRANSACTION_FIELDS as unknown as TagCollection;

interface DatasetAttributes {
  booleanAttributes: TagCollection;
  isLoading: boolean;
  numberAttributes: TagCollection;
  secondaryAliases: TagCollection;
  stringAttributes: TagCollection;
}

const EMPTY_COLLECTION: TagCollection = {};

function keysOf(...collections: TagCollection[]): Set<string> {
  const keys = new Set<string>();
  collections.forEach(collection => {
    Object.keys(collection).forEach(key => keys.add(key));
  });
  return keys;
}

/**
 * The `errors` dataset is not an EAP trace-item type, so its searchable keys are
 * the static Discover error fields plus whatever tags the org has indexed.
 */
function useErrorAttributes(): DatasetAttributes {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();
  const datetimeParams = normalizeDateTimeParams(selection.datetime);

  const {data, isPending} = useFetchOrganizationTags(
    {
      orgSlug: organization.slug,
      dataset: Dataset.ERRORS,
      projectIds: selection.projects.map(String),
      keepPreviousData: true,
      statsPeriod: datetimeParams.statsPeriod,
      start: datetimeParams.start,
      end: datetimeParams.end,
      enabled: isReady,
    },
    {}
  );

  return useMemo(() => {
    const orgTags: TagCollection = Object.fromEntries(
      (data ?? []).map(tag => [
        tag.key,
        {key: tag.key, name: tag.key, kind: FieldKind.TAG},
      ])
    );

    return {
      stringAttributes: {...orgTags, ...ERROR_FIELD_TAGS},
      numberAttributes: EMPTY_COLLECTION,
      booleanAttributes: EMPTY_COLLECTION,
      secondaryAliases: EMPTY_COLLECTION,
      // A failed or slow tag fetch narrows autocomplete rather than blocking the
      // page — the static field list already covers the common keys.
      isLoading: isReady && isPending,
    };
  }, [data, isPending, isReady]);
}

/** Feedback searchable keys, from the issue-platform dataset's org tags. */
function useFeedbackAttributes(): DatasetAttributes {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();
  const datetimeParams = normalizeDateTimeParams(selection.datetime);

  const {data, isPending} = useFetchOrganizationTags(
    {
      orgSlug: organization.slug,
      dataset: Dataset.ISSUE_PLATFORM,
      projectIds: selection.projects.map(String),
      keepPreviousData: true,
      statsPeriod: datetimeParams.statsPeriod,
      start: datetimeParams.start,
      end: datetimeParams.end,
      enabled: isReady,
    },
    {}
  );

  return useMemo(() => {
    const orgTags: TagCollection = Object.fromEntries(
      (data ?? []).map(tag => [
        tag.key,
        {key: tag.key, name: tag.key, kind: FieldKind.TAG},
      ])
    );

    return {
      stringAttributes: orgTags,
      numberAttributes: EMPTY_COLLECTION,
      booleanAttributes: EMPTY_COLLECTION,
      secondaryAliases: EMPTY_COLLECTION,
      isLoading: isReady && isPending,
    };
  }, [data, isPending, isReady]);
}

/**
 * One EAP dataset's attributes across all three types.
 *
 * The three calls resolve to the same query key, so this is a single request per
 * dataset — react-query dedupes the rest.
 */
function useEapAttributes(itemType: TraceItemDataset): DatasetAttributes {
  const string = useTraceItemDatasetAttributes(itemType, {}, 'string');
  const number = useTraceItemDatasetAttributes(itemType, {}, 'number');
  const boolean = useTraceItemDatasetAttributes(itemType, {}, 'boolean');

  return useMemo(
    () => ({
      stringAttributes: string.attributes,
      numberAttributes: number.attributes,
      booleanAttributes: boolean.attributes,
      secondaryAliases: {...string.secondaryAliases, ...number.secondaryAliases},
      isLoading: string.isLoading || number.isLoading || boolean.isLoading,
    }),
    [string, number, boolean]
  );
}

export interface SessionAttributes {
  /** Merged across datasets, for the search bar's key autocomplete. */
  booleanAttributes: TagCollection;
  /** True while any dataset's key list is still loading. */
  isLoading: boolean;
  /** Per-dataset searchable keys, for routing a query to datasets. */
  knownKeys: KnownKeysByDataset;
  numberAttributes: TagCollection;
  secondaryAliases: TagCollection;
  stringAttributes: TagCollection;
}

/**
 * Searchable attributes across the four datasets a `session.id` can appear in.
 *
 * Serves two purposes, which is why they share a hook: the union feeds the search
 * bar's autocomplete, and the per-dataset key sets decide which datasets a given
 * query can be answered by — see `datasetsForQuery`.
 */
export function useSessionAttributes(): SessionAttributes {
  const spans = useEapAttributes(TraceItemDataset.SPANS);
  const logs = useEapAttributes(TraceItemDataset.LOGS);
  const metrics = useEapAttributes(TraceItemDataset.TRACEMETRICS);
  const errors = useErrorAttributes();
  const feedback = useFeedbackAttributes();

  return useMemo(() => {
    const knownKeys: KnownKeysByDataset = {
      logs: keysOfDataset(logs),
      metrics: keysOfDataset(metrics),
      traces: keysOfDataset(spans),
      errors: keysOfDataset(errors),
      feedback: keysOfDataset(feedback),
    };

    // `traces` is the spans dataset, so its searchable keys are the span ones —
    // all of them, not just those of segment spans. A query is used to *find*
    // sessions, and a session whose child span matches is still a match.
    //
    // Spans last so their definitions win a key collision: they are the richest
    // dataset and the one most session searches are aimed at.
    const order = [feedback, errors, metrics, logs, spans];

    return {
      knownKeys,
      stringAttributes: Object.assign({}, ...order.map(d => d.stringAttributes)),
      numberAttributes: Object.assign({}, ...order.map(d => d.numberAttributes)),
      booleanAttributes: Object.assign({}, ...order.map(d => d.booleanAttributes)),
      secondaryAliases: Object.assign({}, ...order.map(d => d.secondaryAliases)),
      isLoading:
        spans.isLoading ||
        logs.isLoading ||
        metrics.isLoading ||
        errors.isLoading ||
        feedback.isLoading,
    };
  }, [spans, logs, metrics, errors, feedback]);
}

function keysOfDataset(attributes: DatasetAttributes): Set<string> {
  return keysOf(
    attributes.stringAttributes,
    attributes.numberAttributes,
    attributes.booleanAttributes
  );
}
