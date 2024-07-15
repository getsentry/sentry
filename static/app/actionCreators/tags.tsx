import type {Query} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ItemType, type SearchGroup} from 'sentry/components/smartSearchBar/types';
import {t} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';
import TagStore, {getBuiltInTags} from 'sentry/stores/tagStore';
import type {Organization, TagCollection} from 'sentry/types';
import type {PageFilters} from 'sentry/types/core';
import {
  getIssueTitleFromType,
  IssueCategory,
  IssueType,
  PriorityLevel,
  type Tag,
  type TagValue,
} from 'sentry/types/group';
import {FieldKey, FieldKind, IsFieldValues, ISSUE_FIELDS} from 'sentry/utils/fields';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

const MAX_TAGS = 1000;

function tagFetchSuccess(tags: Tag[] | undefined) {
  // We occasionally get undefined passed in when APIs are having a bad time.
  tags = tags || [];
  const trimmedTags = tags.slice(0, MAX_TAGS);

  if (tags.length > MAX_TAGS) {
    AlertStore.addAlert({
      message: t('You have too many unique tags and some have been truncated'),
      type: 'warning',
    });
  }
  TagStore.loadTagsSuccess(trimmedTags);
}

/**
 * Load an organization's tags based on a global selection value.
 */
export function loadOrganizationTags(
  api: Client,
  orgSlug: string,
  selection: PageFilters
): Promise<void> {
  TagStore.reset();

  const query: Query = selection.datetime
    ? {...normalizeDateTimeParams(selection.datetime)}
    : {};
  query.use_cache = '1';

  if (selection.projects) {
    query.project = selection.projects.map(String);
  }

  return api
    .requestPromise(`/organizations/${orgSlug}/tags/`, {
      method: 'GET',
      query,
    })
    .then(tagFetchSuccess)
    .catch(() => {
      addErrorMessage(t('Unable to load tags'));
    });
}

/**
 * Fetch tags for an organization or a subset or projects.
 */
export function fetchOrganizationTags(
  api: Client,
  orgId: string,
  projectIds: string[] | null = null
) {
  TagStore.reset();

  const url = `/organizations/${orgId}/tags/`;
  const query: Query = {use_cache: '1'};
  if (projectIds) {
    query.project = projectIds;
  }

  const promise = api.requestPromise(url, {
    method: 'GET',
    query,
  });

  promise.then(tagFetchSuccess);

  return promise;
}

/**
 * Fetch tag values for an organization.
 * The `projectIds` argument can be used to subset projects.
 */
export function fetchTagValues({
  api,
  orgSlug,
  tagKey,
  endpointParams,
  includeReplays,
  includeSessions,
  includeTransactions,
  projectIds,
  search,
  sort,
}: {
  api: Client;
  orgSlug: string;
  tagKey: string;
  endpointParams?: Query;
  includeReplays?: boolean;
  includeSessions?: boolean;
  includeTransactions?: boolean;
  projectIds?: string[];
  search?: string;
  sort?: string;
}): Promise<TagValue[]> {
  const url = `/organizations/${orgSlug}/tags/${tagKey}/values/`;

  const query: Query = {};
  if (search) {
    query.query = search;
  }
  if (projectIds) {
    query.project = projectIds;
  }
  if (endpointParams) {
    if (endpointParams.start) {
      query.start = endpointParams.start;
    }
    if (endpointParams.end) {
      query.end = endpointParams.end;
    }
    if (endpointParams.statsPeriod) {
      query.statsPeriod = endpointParams.statsPeriod;
    }
  }

  if (includeTransactions) {
    query.includeTransactions = '1';
  }

  if (includeSessions) {
    query.includeSessions = '1';
  }

  if (includeReplays) {
    query.includeReplays = '1';
  }

  if (sort) {
    query.sort = sort;
  }

  return api.requestPromise(url, {
    method: 'GET',
    query,
  });
}

export function fetchSpanFieldValues({
  api,
  orgSlug,
  fieldKey,
  endpointParams,
  projectIds,
  search,
}: {
  api: Client;
  fieldKey: string;
  orgSlug: string;
  endpointParams?: Query;
  projectIds?: string[];
  search?: string;
}): Promise<TagValue[]> {
  const url = `/organizations/${orgSlug}/spans/fields/${fieldKey}/values/`;

  const query: Query = {};
  if (search) {
    query.query = search;
  }
  if (projectIds) {
    query.project = projectIds;
  }
  if (endpointParams) {
    if (endpointParams.start) {
      query.start = endpointParams.start;
    }
    if (endpointParams.end) {
      query.end = endpointParams.end;
    }
    if (endpointParams.statsPeriod) {
      query.statsPeriod = endpointParams.statsPeriod;
    }
  }

  return api.requestPromise(url, {
    method: 'GET',
    query,
  });
}

type FetchOrganizationTagsParams = {
  orgSlug: string;
  // TODO: Change this to Dataset type once IssuePlatform is added
  dataset?: string;
  projectIds?: string[];
  useCache?: boolean;
};

export const makeFetchOrganizationTags = ({
  orgSlug,
  dataset,
  projectIds,
  useCache = true,
}: FetchOrganizationTagsParams): ApiQueryKey => [
  `/organizations/${orgSlug}/tags/`,
  {query: {dataset, useCache, project: projectIds}},
];

export const useFetchOrganizationTags = (
  params: FetchOrganizationTagsParams,
  options: Partial<UseApiQueryOptions<Tag[]>>
) => {
  return useApiQuery<Tag[]>(makeFetchOrganizationTags(params), {
    staleTime: Infinity,
    keepPreviousData: true,
    ...options,
  });
};

type UseFetchIssueTagsParams = {
  orgSlug: string;
  projectIds: string[];
  useCache?: boolean;
};

export const useFetchIssueOrganizationTags = ({
  orgSlug,
  projectIds,
  useCache = true,
}: UseFetchIssueTagsParams) => {
  const eventsTagsQuery = useFetchOrganizationTags(
    {
      orgSlug,
      projectIds,
      dataset: Dataset.ERRORS,
      useCache,
    },
    {}
  );

  const issuePlatformTagsQuery = useFetchOrganizationTags(
    {
      orgSlug,
      projectIds,
      dataset: 'search_issues',
      useCache,
    },
    {}
  );

  const eventsTags = [
    ...(eventsTagsQuery.data || []),
    ...(issuePlatformTagsQuery.data || []),
  ];

  const eventsTagCollection: TagCollection = eventsTags.reduce<TagCollection>(
    (acc, tag) => {
      acc[tag.key] = {...tag, predefined: false, kind: FieldKind.TAG};
      return acc;
    },
    {}
  );

  return {
    tags: eventsTagCollection,
    isLoading: eventsTagsQuery.isLoading || issuePlatformTagsQuery.isLoading,
    isError: eventsTagsQuery.isError || issuePlatformTagsQuery.isError,
  };
};

export function builtInIssuesFields(
  org: Organization,
  hasFieldValues: string[]
): TagCollection {
  const builtInTags = getBuiltInTags(org);

  const tagCollection: TagCollection = {
    [FieldKey.IS]: {
      ...builtInTags[FieldKey.IS],
      key: FieldKey.IS,
      name: 'Status',
      values: Object.values(IsFieldValues),
      maxSuggestedValues: Object.values(IsFieldValues).length,
      predefined: true,
    },
    [FieldKey.HAS]: {
      ...builtInTags[FieldKey.HAS],
      key: FieldKey.HAS,
      name: 'Has Tag',
      values: hasFieldValues,
      predefined: true,
    },
    [FieldKey.ASSIGNED]: {
      ...builtInTags[FieldKey.ASSIGNED],
      key: FieldKey.ASSIGNED,
      name: 'Assigned To',
      values: [],
      predefined: true,
    },
    [FieldKey.BOOKMARKS]: {
      ...builtInTags[FieldKey.BOOKMARKS],
      name: 'Bookmarked By',
      values: [],
      predefined: true,
    },
    [FieldKey.ISSUE_CATEGORY]: {
      ...builtInTags[FieldKey.ISSUE_CATEGORY],
      name: 'Issue Category',
      values: [
        IssueCategory.ERROR,
        IssueCategory.PERFORMANCE,
        IssueCategory.REPLAY,
        IssueCategory.CRON,
      ],
      predefined: true,
    },
    [FieldKey.ISSUE_TYPE]: {
      ...builtInTags[FieldKey.ISSUE_TYPE],
      name: 'Issue Type',
      values: [
        IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
        IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS,
        IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
        IssueType.PERFORMANCE_SLOW_DB_QUERY,
        IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET,
        IssueType.PERFORMANCE_UNCOMPRESSED_ASSET,
        IssueType.PERFORMANCE_ENDPOINT_REGRESSION,
        IssueType.PROFILE_FILE_IO_MAIN_THREAD,
        IssueType.PROFILE_IMAGE_DECODE_MAIN_THREAD,
        IssueType.PROFILE_JSON_DECODE_MAIN_THREAD,
        IssueType.PROFILE_REGEX_MAIN_THREAD,
        IssueType.PROFILE_FUNCTION_REGRESSION,
      ].map(value => ({
        icon: null,
        title: value,
        name: value,
        documentation: getIssueTitleFromType(value),
        value,
        type: ItemType.TAG_VALUE,
        children: [],
      })) as SearchGroup[],
      predefined: true,
    },
    [FieldKey.LAST_SEEN]: {
      ...builtInTags[FieldKey.LAST_SEEN],
      name: 'Last Seen',
      values: [],
      predefined: false,
    },
    [FieldKey.FIRST_SEEN]: {
      ...builtInTags[FieldKey.FIRST_SEEN],
      name: 'First Seen',
      values: [],
      predefined: false,
    },
    [FieldKey.FIRST_RELEASE]: {
      ...builtInTags[FieldKey.FIRST_RELEASE],
      name: 'First Release',
      values: ['latest'],
      predefined: true,
    },
    [FieldKey.EVENT_TIMESTAMP]: {
      ...builtInTags[FieldKey.EVENT_TIMESTAMP],
      name: 'Event Timestamp',
      values: [],
      predefined: true,
    },
    [FieldKey.TIMES_SEEN]: {
      ...builtInTags[FieldKey.TIMES_SEEN],
      name: 'Times Seen',
      isInput: true,
      // Below values are required or else SearchBar will attempt to get values
      // This is required or else SearchBar will attempt to get values
      values: [],
      predefined: true,
    },
    [FieldKey.ASSIGNED_OR_SUGGESTED]: {
      ...builtInTags[FieldKey.ASSIGNED_OR_SUGGESTED],
      name: 'Assigned or Suggested',
      isInput: true,
      values: [],
      predefined: true,
    },
    [FieldKey.ISSUE_PRIORITY]: {
      ...builtInTags[FieldKey.ISSUE_PRIORITY],
      name: 'Issue Priority',
      values: [PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW],
      predefined: true,
    },
  };

  // Ony include fields that that are part of the ISSUE_FIELDS. This is
  // because we may sometimes have fields that are turned off by removing
  // them from ISSUE_FIELDS
  const filteredCollection = Object.entries(tagCollection).filter(([key]) =>
    ISSUE_FIELDS.includes(key as FieldKey)
  );

  return {...builtInTags, ...Object.fromEntries(filteredCollection)};
}
