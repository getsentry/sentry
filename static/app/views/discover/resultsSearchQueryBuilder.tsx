import {useCallback, useMemo} from 'react';
import omit from 'lodash/omit';

import {fetchSpanFieldValues, fetchTagValues} from 'sentry/actionCreators/tags';
import {
  STATIC_FIELD_TAGS,
  STATIC_FIELD_TAGS_SET,
  STATIC_FIELD_TAGS_WITHOUT_ERROR_FIELDS,
  STATIC_FIELD_TAGS_WITHOUT_TRACING,
  STATIC_FIELD_TAGS_WITHOUT_TRANSACTION_FIELDS,
  STATIC_SEMVER_TAGS,
  STATIC_SPAN_TAGS,
} from 'sentry/components/events/searchBarFieldConstants';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {
  CallbackSearchState,
  FilterKeySection,
} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import {SavedSearchType, type TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {Field} from 'sentry/utils/discover/fields';
import {
  ALL_INSIGHTS_FILTER_KEY_SECTIONS,
  COMBINED_DATASET_FILTER_KEY_SECTIONS,
  ERRORS_DATASET_FILTER_KEY_SECTIONS,
  isAggregateField,
  isEquation,
  isMeasurement,
  parseFunction,
} from 'sentry/utils/discover/fields';
import {
  DiscoverDatasets,
  DiscoverDatasetsToDatasetMap,
} from 'sentry/utils/discover/types';
import {
  DEVICE_CLASS_TAG_VALUES,
  FieldKey,
  FieldKind,
  isDeviceClass,
} from 'sentry/utils/fields';
import type Measurements from 'sentry/utils/measurements/measurements';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useTags from 'sentry/utils/useTags';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';

const getFunctionTags = (fields: Readonly<Field[]> | undefined) => {
  if (!fields?.length) {
    return [];
  }
  return fields.reduce((acc, item) => {
    if (
      !STATIC_FIELD_TAGS_SET.has(item.field) &&
      !isEquation(item.field) &&
      !isCustomMeasurement(item.field)
    ) {
      const parsedFunction = parseFunction(item.field);
      if (parsedFunction) {
        acc[parsedFunction.name] = {
          key: parsedFunction.name,
          name: parsedFunction.name,
          kind: FieldKind.FUNCTION,
        };
      }
    }

    return acc;
  }, {});
};

const getMeasurementTags = (
  measurements: Parameters<
    React.ComponentProps<typeof Measurements>['children']
  >[0]['measurements'],
  customMeasurements:
    | Parameters<React.ComponentProps<typeof Measurements>['children']>[0]['measurements']
    | undefined
) => {
  const measurementsWithKind = Object.keys(measurements).reduce((tags, key) => {
    tags[key] = {
      ...measurements[key],
      kind: FieldKind.MEASUREMENT,
    };
    return tags;
  }, {});

  if (!customMeasurements) {
    return measurementsWithKind;
  }

  return Object.keys(customMeasurements).reduce((tags, key) => {
    tags[key] = {
      ...customMeasurements[key],
      kind: FieldKind.MEASUREMENT,
    };
    return tags;
  }, measurementsWithKind);
};

export const getHasTag = (tags: TagCollection) => ({
  key: FieldKey.HAS,
  name: 'Has property',
  values: Object.keys(tags).sort((a, b) => {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  }),
  predefined: true,
  kind: FieldKind.FIELD,
});

type Props = {
  customMeasurements?: CustomMeasurementCollection;
  dataset?: DiscoverDatasets;
  fields?: Readonly<Field[]>;
  includeSessionTagsValues?: boolean;
  includeTransactions?: boolean;
  omitTags?: string[];
  onChange?: (query: string, state: CallbackSearchState) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  projectIds?: number[] | Readonly<number[]>;
  query?: string;
  searchSource?: string;
  supportedTags?: TagCollection | undefined;
};

const EXCLUDED_FILTER_KEYS = [FieldKey.ENVIRONMENT, FieldKey.TOTAL_COUNT];

function ResultsSearchQueryBuilder(props: Props) {
  const {
    omitTags,
    fields,
    projectIds,
    includeSessionTagsValues,
    customMeasurements,
    dataset,
    includeTransactions = true,
    placeholder,
  } = props;

  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const tags = useTags();

  const filteredTags = useMemo(() => {
    return omitTags && omitTags.length > 0
      ? omit(tags, omitTags, EXCLUDED_FILTER_KEYS)
      : omit(tags, EXCLUDED_FILTER_KEYS);
  }, [tags, omitTags]);

  const placeholderText = useMemo(() => {
    return placeholder ?? t('Search for events, users, tags, and more');
  }, [placeholder]);
  const measurements = useMemo(() => getMeasurements(), []);
  const functionTags = useMemo(() => getFunctionTags(fields), [fields]);

  // Returns array of tag values that substring match `query`; invokes `callback`
  // with data when ready
  const getEventFieldValues = useCallback(
    async (tag, query): Promise<string[]> => {
      const projectIdStrings = (projectIds as Readonly<number>[])?.map(String);

      if (isAggregateField(tag.key) || isMeasurement(tag.key)) {
        // We can't really auto suggest values for aggregate fields
        // or measurements, so we simply don't
        return Promise.resolve([]);
      }

      // device.class is stored as "numbers" in snuba, but we want to suggest high, medium,
      // and low search filter values because discover maps device.class to these values.
      if (isDeviceClass(tag.key)) {
        return Promise.resolve(DEVICE_CLASS_TAG_VALUES);
      }
      const fetchPromise =
        dataset === DiscoverDatasets.SPANS_INDEXED
          ? fetchSpanFieldValues({
              api,
              endpointParams: normalizeDateTimeParams(selection.datetime),
              orgSlug: organization.slug,
              fieldKey: tag.key,
              search: query,
              projectIds: projectIdStrings,
            })
          : fetchTagValues({
              api,
              endpointParams: normalizeDateTimeParams(selection.datetime),
              orgSlug: organization.slug,
              tagKey: tag.key,
              search: query,
              projectIds: projectIdStrings,
              // allows searching for tags on transactions as well
              includeTransactions,
              // allows searching for tags on sessions as well
              includeSessions: includeSessionTagsValues,
              dataset: dataset ? DiscoverDatasetsToDatasetMap[dataset] : undefined,
            });

      try {
        const results = await fetchPromise;
        return results.filter(({name}) => defined(name)).map(({name}) => name);
      } catch (error) {
        throw new Error('Unable to fetch event field values');
      }
    },
    [
      api,
      organization,
      selection.datetime,
      projectIds,
      includeTransactions,
      includeSessionTagsValues,
      dataset,
    ]
  );

  const getTagList: TagCollection = useMemo(() => {
    const measurementsWithKind = getMeasurementTags(measurements, customMeasurements);
    const orgHasPerformanceView = organization.features.includes('performance-view');

    const combinedTags: TagCollection =
      dataset === DiscoverDatasets.ERRORS
        ? Object.assign({}, functionTags, STATIC_FIELD_TAGS_WITHOUT_TRANSACTION_FIELDS)
        : dataset === DiscoverDatasets.TRANSACTIONS ||
            dataset === DiscoverDatasets.METRICS_ENHANCED
          ? Object.assign(
              {},
              measurementsWithKind,
              functionTags,
              STATIC_SPAN_TAGS,
              STATIC_FIELD_TAGS_WITHOUT_ERROR_FIELDS
            )
          : orgHasPerformanceView
            ? Object.assign(
                {},
                measurementsWithKind,
                functionTags,
                STATIC_SPAN_TAGS,
                STATIC_FIELD_TAGS
              )
            : Object.assign({}, STATIC_FIELD_TAGS_WITHOUT_TRACING);

    Object.assign(combinedTags, filteredTags, STATIC_SEMVER_TAGS);

    combinedTags.has = getHasTag(combinedTags);

    return combinedTags;
  }, [
    measurements,
    dataset,
    customMeasurements,
    functionTags,
    filteredTags,
    organization.features,
  ]);

  const filterKeySections = useMemo(() => {
    const customTagsSection: FilterKeySection = {
      value: 'custom_fields',
      label: 'Custom Tags',
      children: Object.keys(filteredTags),
    };

    if (
      dataset === DiscoverDatasets.TRANSACTIONS ||
      dataset === DiscoverDatasets.METRICS_ENHANCED
    ) {
      return [...ALL_INSIGHTS_FILTER_KEY_SECTIONS, customTagsSection];
    }

    if (dataset === DiscoverDatasets.ERRORS) {
      return [...ERRORS_DATASET_FILTER_KEY_SECTIONS, customTagsSection];
    }

    return [...COMBINED_DATASET_FILTER_KEY_SECTIONS, customTagsSection];
  }, [filteredTags, dataset]);

  return (
    <SearchQueryBuilder
      placeholder={placeholderText}
      filterKeys={getTagList}
      initialQuery={props.query ?? ''}
      onSearch={props.onSearch}
      onChange={props.onChange}
      searchSource={props.searchSource || 'eventsv2'}
      filterKeySections={filterKeySections}
      getTagValues={getEventFieldValues}
      recentSearches={SavedSearchType.EVENT}
      showUnsubmittedIndicator
    />
  );
}

export default ResultsSearchQueryBuilder;
