import {useMemo} from 'react';

import {useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import {makeFeatureFlagSearchKey} from 'sentry/components/events/featureFlags/utils';
import {ItemType, type SearchGroup} from 'sentry/components/searchBar/types';
import {
  FixabilityScoreThresholds,
  getIssueTitleFromType,
  ISSUE_CATEGORY_TO_DESCRIPTION,
  IssueCategory,
  PriorityLevel,
  VALID_ISSUE_CATEGORIES,
  VISIBLE_ISSUE_TYPES,
  type Tag,
  type TagCollection,
} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {escapeIssueTagKey} from 'sentry/utils';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import {
  FieldKey,
  FieldKind,
  getIsFieldDescriptionFromValue,
  IsFieldValues,
  ISSUE_EVENT_PROPERTY_FIELDS,
  ISSUE_FIELDS,
  ISSUE_PROPERTY_FIELDS,
} from 'sentry/utils/fields';
import useAssignedSearchValues from 'sentry/utils/membersAndTeams/useAssignedSearchValues';
import useMemberUsernames from 'sentry/utils/membersAndTeams/useMemberUsernames';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import useFetchOrganizationFeatureFlags from 'sentry/views/issueList/utils/useFetchOrganizationFeatureFlags';

type UseFetchIssueTagsParams = {
  org: Organization;
  projectIds: string[];
  enabled?: boolean;
  end?: string;
  includeFeatureFlags?: boolean;
  keepPreviousData?: boolean;
  start?: string;
  statsPeriod?: string | null;
  useCache?: boolean;
};

const PREDEFINED_FIELDS = {
  ...ISSUE_PROPERTY_FIELDS.reduce<TagCollection>((acc, tag) => {
    acc[tag] = {key: tag, name: tag, predefined: true, kind: FieldKind.ISSUE_FIELD};
    return acc;
  }, {}),
  ...ISSUE_EVENT_PROPERTY_FIELDS.reduce<TagCollection>((acc, tag) => {
    acc[tag] = {key: tag, name: tag, predefined: false, kind: FieldKind.EVENT_FIELD};
    return acc;
  }, {}),
};

// "environment" is excluded because it should be handled by the environment page filter
const EXCLUDED_TAGS = [
  'environment',
  'ai_categorization.label.0',
  'ai_categorization.label.1',
  'ai_categorization.label.2',
  'ai_categorization.label.3',
  'ai_categorization.label.4',
  'ai_categorization.label.5',
  'ai_categorization.label.6',
  'ai_categorization.label.7',
  'ai_categorization.label.8',
  'ai_categorization.label.9',
  'ai_categorization.label.10',
  'ai_categorization.label.11',
  'ai_categorization.label.12',
  'ai_categorization.label.13',
  'ai_categorization.label.14',
  'ai_categorization.label.15',
  'ai_categorization.labels',
];

const SEARCHABLE_ISSUE_CATEGORIES = VALID_ISSUE_CATEGORIES.filter(
  category => category !== IssueCategory.FEEDBACK
);

/**
 * Certain field keys may conflict with custom tags. In this case, the tag will be
 * renamed, e.g. `platform` -> `tags[platform]`
 */
const renameConflictingTags = (tags: TagCollection): TagCollection => {
  const renamedTags: TagCollection = {};

  for (const [key, tag] of Object.entries(tags)) {
    const newKey = escapeIssueTagKey(key);
    if (key === newKey) {
      renamedTags[key] = tag;
    } else {
      renamedTags[newKey] = {
        ...tag,
        key: newKey,
        name: newKey,
      };
    }
  }

  return renamedTags;
};

/**
 * Fetches the tags from both the Errors and IssuePlatform dataset
 * and combines them with builtin and predfined tags.
 */
export const useFetchIssueTags = ({
  org,
  projectIds,
  keepPreviousData = false,
  useCache = true,
  enabled = true,
  includeFeatureFlags = false,
  ...statsPeriodParams
}: UseFetchIssueTagsParams) => {
  const eventsTagsQuery = useFetchOrganizationTags(
    {
      orgSlug: org.slug,
      projectIds,
      dataset: Dataset.ERRORS,
      useCache,
      enabled,
      keepPreviousData,
      ...statsPeriodParams,
    },
    {}
  );

  const issuePlatformTagsQuery = useFetchOrganizationTags(
    {
      orgSlug: org.slug,
      projectIds,
      dataset: Dataset.ISSUE_PLATFORM,
      useCache,
      enabled,
      keepPreviousData,
      ...statsPeriodParams,
    },
    {}
  );

  // For now, feature flag keys (see `flags` column of the ERRORS dataset) are exposed from the tags endpoint,
  // with query param useFlagsBackend=1. This is used for issue stream search suggestions.
  const featureFlagTagsQuery = useFetchOrganizationFeatureFlags(
    {
      orgSlug: org.slug,
      projectIds,
      useCache,
      enabled: enabled && includeFeatureFlags, // Only make this query if includeFeatureFlags is true.
      keepPreviousData,
      ...statsPeriodParams,
    },
    {}
  );

  const assignedValues = useAssignedSearchValues();
  const usernames = useMemberUsernames();

  const allTags = useMemo(() => {
    const eventsTags: Tag[] = eventsTagsQuery.data || [];
    const issuePlatformTags: Tag[] = issuePlatformTagsQuery.data || [];
    const featureFlagTags: Tag[] = featureFlagTagsQuery.data || [];

    const allTagsCollection: TagCollection = eventsTags.reduce<TagCollection>(
      (acc, tag) => {
        acc[tag.key] = {...tag, kind: FieldKind.TAG};
        return acc;
      },
      {}
    );

    issuePlatformTags.forEach(tag => {
      if (allTagsCollection[tag.key]) {
        allTagsCollection[tag.key]!.totalValues =
          (allTagsCollection[tag.key]!.totalValues ?? 0) + (tag.totalValues ?? 0);
      } else {
        allTagsCollection[tag.key] = {...tag, kind: FieldKind.TAG};
      }
    });

    featureFlagTags.forEach(tag => {
      const key = makeFeatureFlagSearchKey(tag.key);
      if (allTagsCollection[key]) {
        allTagsCollection[key].totalValues =
          (allTagsCollection[key].totalValues ?? 0) + (tag.totalValues ?? 0);
      } else {
        allTagsCollection[key] = {
          ...tag,
          kind: FieldKind.FEATURE_FLAG,
          key, // Update with wrapped key.
        };
      }
    });

    for (const excludedTag of EXCLUDED_TAGS) {
      delete allTagsCollection[excludedTag];
    }

    const renamedTags = renameConflictingTags(allTagsCollection);

    const additionalTags = builtInIssuesFields({
      currentTags: renamedTags,
      assigneeFieldValues: assignedValues,
      bookmarksValues: usernames,
    });

    return {
      ...renamedTags,
      ...additionalTags,
    };
  }, [
    eventsTagsQuery.data,
    issuePlatformTagsQuery.data,
    featureFlagTagsQuery.data,
    usernames,
    assignedValues,
  ]);

  return {
    tags: allTags,
    isLoading:
      eventsTagsQuery.isPending ||
      issuePlatformTagsQuery.isPending ||
      featureFlagTagsQuery.isPending,
    isError:
      eventsTagsQuery.isError ||
      issuePlatformTagsQuery.isError ||
      featureFlagTagsQuery.isError,
  };
};

function builtInIssuesFields({
  currentTags,
  assigneeFieldValues = [],
  bookmarksValues = [],
}: {
  assigneeFieldValues: SearchGroup[] | string[];
  bookmarksValues: string[];
  currentTags: TagCollection;
}): TagCollection {
  const semverFields: TagCollection = Object.values(SEMVER_TAGS).reduce<TagCollection>(
    (acc, tag) => {
      return {
        ...acc,
        [tag.key]: {
          predefined: false,
          ...tag,
          kind: FieldKind.EVENT_FIELD,
        },
      };
    },
    {}
  );
  const hasFieldValues = [
    ...Object.values(currentTags).map(tag => tag.key),
    ...Object.values(SEMVER_TAGS).map(tag => tag.key),
  ].sort();

  const tagCollection: TagCollection = {
    [FieldKey.IS]: {
      ...PREDEFINED_FIELDS[FieldKey.IS],
      key: FieldKey.IS,
      name: 'Status',
      values: Object.values(IsFieldValues).map(value => ({
        icon: null,
        title: value,
        name: value,
        documentation: getIsFieldDescriptionFromValue(value),
        value,
        type: ItemType.TAG_VALUE,
        children: [],
      })),
      maxSuggestedValues: Object.values(IsFieldValues).length,
      predefined: true,
    },
    [FieldKey.HAS]: {
      ...PREDEFINED_FIELDS[FieldKey.HAS],
      key: FieldKey.HAS,
      name: 'Has Tag',
      values: hasFieldValues,
      predefined: true,
    },
    [FieldKey.ASSIGNED]: {
      ...PREDEFINED_FIELDS[FieldKey.ASSIGNED],
      key: FieldKey.ASSIGNED,
      name: 'Assigned To',
      values: assigneeFieldValues,
      predefined: true,
    },
    [FieldKey.ASSIGNED_OR_SUGGESTED]: {
      ...PREDEFINED_FIELDS[FieldKey.ASSIGNED_OR_SUGGESTED]!,
      name: 'Assigned or Suggested',
      isInput: true,
      values: assigneeFieldValues,
      predefined: true,
    },
    [FieldKey.BOOKMARKS]: {
      ...PREDEFINED_FIELDS[FieldKey.BOOKMARKS]!,
      name: 'Bookmarked By',
      values: bookmarksValues,
      predefined: true,
    },
    [FieldKey.ISSUE_CATEGORY]: {
      ...PREDEFINED_FIELDS[FieldKey.ISSUE_CATEGORY]!,
      name: 'Issue Category',
      values: SEARCHABLE_ISSUE_CATEGORIES.map(value => ({
        icon: null,
        title: value,
        name: value,
        documentation: ISSUE_CATEGORY_TO_DESCRIPTION[value],
        value,
        type: ItemType.TAG_VALUE,
        children: [],
      })),
      predefined: true,
    },
    [FieldKey.ISSUE_TYPE]: {
      ...PREDEFINED_FIELDS[FieldKey.ISSUE_TYPE]!,
      name: 'Issue Type',
      values: VISIBLE_ISSUE_TYPES.map(value => ({
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
      ...PREDEFINED_FIELDS[FieldKey.LAST_SEEN]!,
      name: 'Last Seen',
      values: [],
      predefined: false,
    },
    [FieldKey.FIRST_SEEN]: {
      ...PREDEFINED_FIELDS[FieldKey.FIRST_SEEN]!,
      name: 'First Seen',
      values: [],
      predefined: false,
    },
    [FieldKey.FIRST_RELEASE]: {
      ...PREDEFINED_FIELDS[FieldKey.FIRST_RELEASE]!,
      name: 'First Release',
      values: [],
      predefined: false,
    },
    [FieldKey.EVENT_TIMESTAMP]: {
      ...PREDEFINED_FIELDS[FieldKey.EVENT_TIMESTAMP]!,
      name: 'Event Timestamp',
      values: [],
      predefined: true,
    },
    [FieldKey.TIMES_SEEN]: {
      ...PREDEFINED_FIELDS[FieldKey.TIMES_SEEN]!,
      name: 'Times Seen',
      isInput: true,
      // Below values are required or else SearchBar will attempt to get values
      // This is required or else SearchBar will attempt to get values
      values: [],
      predefined: true,
    },
    [FieldKey.ISSUE_PRIORITY]: {
      ...PREDEFINED_FIELDS[FieldKey.ISSUE_PRIORITY]!,
      name: 'Issue Priority',
      values: [PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW],
      predefined: true,
    },
    [FieldKey.ISSUE_SEER_ACTIONABILITY]: {
      ...PREDEFINED_FIELDS[FieldKey.ISSUE_SEER_ACTIONABILITY]!,
      name: 'Issue Fixability',
      values: [
        FixabilityScoreThresholds.SUPER_HIGH,
        FixabilityScoreThresholds.HIGH,
        FixabilityScoreThresholds.MEDIUM,
        FixabilityScoreThresholds.LOW,
        FixabilityScoreThresholds.SUPER_LOW,
      ],
      predefined: true,
    },
    [FieldKey.ISSUE_SEER_LAST_RUN]: {
      ...PREDEFINED_FIELDS[FieldKey.ISSUE_SEER_LAST_RUN]!,
      name: 'Issue Fix Last Triggered',
      values: [],
      predefined: false,
    },
  };

  // Ony include fields that that are part of the ISSUE_FIELDS. This is
  // because we may sometimes have fields that are turned off by removing
  // them from ISSUE_FIELDS
  const filteredCollection = Object.entries(tagCollection).filter(([key]) =>
    ISSUE_FIELDS.includes(key as FieldKey)
  );

  return {
    ...PREDEFINED_FIELDS,
    ...Object.fromEntries(filteredCollection),
    ...semverFields,
  };
}
