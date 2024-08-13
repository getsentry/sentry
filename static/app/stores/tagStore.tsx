import {createStore} from 'reflux';

import {ItemType, type SearchGroup} from 'sentry/components/smartSearchBar/types';
import type {Tag, TagCollection} from 'sentry/types/group';
import {
  getIssueTitleFromType,
  IssueCategory,
  IssueType,
  PriorityLevel,
} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import {
  FieldKey,
  FieldKind,
  ISSUE_EVENT_PROPERTY_FIELDS,
  ISSUE_FIELDS,
  ISSUE_PROPERTY_FIELDS,
} from 'sentry/utils/fields';

import type {StrictStoreDefinition} from './types';

// This list is only used on issues. Events/discover
// have their own field list that exists elsewhere.
const BUILTIN_TAGS = ISSUE_FIELDS.reduce<TagCollection>((acc, tag) => {
  acc[tag] = {key: tag, name: tag};
  return acc;
}, {});

// For the new query builder, we need to differentiate between issue and event fields
const BUILTIN_TAGS_BY_CATEGORY = {
  ...ISSUE_PROPERTY_FIELDS.reduce<TagCollection>((acc, tag) => {
    acc[tag] = {key: tag, name: tag, predefined: true, kind: FieldKind.ISSUE_FIELD};
    return acc;
  }, {}),
  ...ISSUE_EVENT_PROPERTY_FIELDS.reduce<TagCollection>((acc, tag) => {
    acc[tag] = {key: tag, name: tag, predefined: false, kind: FieldKind.EVENT_FIELD};
    return acc;
  }, {}),
};

export function getBuiltInTags(organization: Organization) {
  if (organization.features.includes('issue-stream-search-query-builder')) {
    return BUILTIN_TAGS_BY_CATEGORY;
  }

  return BUILTIN_TAGS;
}

interface TagStoreDefinition extends StrictStoreDefinition<TagCollection> {
  getIssueAttributes(organization: Organization): TagCollection;
  getIssueTags(org: Organization): TagCollection;
  loadTagsSuccess(data: Tag[]): void;
  reset(): void;
}

const storeConfig: TagStoreDefinition = {
  state: {},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
    this.state = {};
  },

  /**
   * Gets only predefined issue attributes
   */
  getIssueAttributes(organization: Organization) {
    // TODO(mitsuhiko): what do we do with translations here?
    const isSuggestions = [
      'resolved',
      'unresolved',
      ...['archived', 'escalating', 'new', 'ongoing', 'regressed'],
      'assigned',
      'unassigned',
      'for_review',
      'linked',
      'unlinked',
    ];

    const sortedTagKeys = Object.keys(this.state).sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    const builtinTags = getBuiltInTags(organization);

    const tagCollection = {
      [FieldKey.IS]: {
        ...builtinTags[FieldKey.IS],
        key: FieldKey.IS,
        name: 'Status',
        values: isSuggestions,
        maxSuggestedValues: isSuggestions.length,
        predefined: true,
      },
      [FieldKey.HAS]: {
        ...builtinTags[FieldKey.HAS],
        key: FieldKey.HAS,
        name: 'Has Tag',
        values: sortedTagKeys,
        predefined: true,
      },
      [FieldKey.ASSIGNED]: {
        ...builtinTags[FieldKey.ASSIGNED],
        key: FieldKey.ASSIGNED,
        name: 'Assigned To',
        values: [],
        predefined: true,
      },
      [FieldKey.BOOKMARKS]: {
        ...builtinTags[FieldKey.BOOKMARKS],
        name: 'Bookmarked By',
        values: [],
        predefined: true,
      },
      [FieldKey.ISSUE_CATEGORY]: {
        ...builtinTags[FieldKey.ISSUE_CATEGORY],
        name: 'Issue Category',
        values: [
          IssueCategory.ERROR,
          IssueCategory.PERFORMANCE,
          IssueCategory.REPLAY,
          IssueCategory.CRON,
          IssueCategory.UPTIME,
        ],
        predefined: true,
      },
      [FieldKey.ISSUE_TYPE]: {
        ...builtinTags[FieldKey.ISSUE_TYPE],
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
        ...builtinTags[FieldKey.LAST_SEEN],
        name: 'Last Seen',
        values: [],
        predefined: false,
      },
      [FieldKey.FIRST_SEEN]: {
        ...builtinTags[FieldKey.FIRST_SEEN],
        name: 'First Seen',
        values: [],
        predefined: false,
      },
      [FieldKey.FIRST_RELEASE]: {
        ...builtinTags[FieldKey.FIRST_RELEASE],
        name: 'First Release',
        values: ['latest'],
        predefined: true,
      },
      [FieldKey.EVENT_TIMESTAMP]: {
        ...builtinTags[FieldKey.EVENT_TIMESTAMP],
        name: 'Event Timestamp',
        values: [],
        predefined: true,
      },
      [FieldKey.TIMES_SEEN]: {
        ...builtinTags[FieldKey.TIMES_SEEN],
        name: 'Times Seen',
        isInput: true,
        // Below values are required or else SearchBar will attempt to get values
        // This is required or else SearchBar will attempt to get values
        values: [],
        predefined: true,
      },
      [FieldKey.ASSIGNED_OR_SUGGESTED]: {
        ...builtinTags[FieldKey.ASSIGNED_OR_SUGGESTED],
        name: 'Assigned or Suggested',
        isInput: true,
        values: [],
        predefined: true,
      },
      [FieldKey.ISSUE_PRIORITY]: {
        ...builtinTags[FieldKey.ISSUE_PRIORITY],
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

    return Object.fromEntries(filteredCollection);
  },

  /**
   * Get all tags including builtin issue tags and issue attributes
   */
  getIssueTags(org: Organization) {
    const eventTags = Object.values(this.state).reduce<TagCollection>((acc, tag) => {
      return {
        ...acc,
        [tag.key]: {
          ...tag,
          kind: FieldKind.TAG,
        },
      };
    }, {});

    const semverFields = Object.values(SEMVER_TAGS).reduce<TagCollection>((acc, tag) => {
      return {
        ...acc,
        [tag.key]: {
          predefined: false,
          ...tag,
          kind: org.features.includes('issue-stream-search-query-builder')
            ? FieldKind.EVENT_FIELD
            : FieldKind.FIELD,
        },
      };
    }, {});

    const issueTags = {
      ...getBuiltInTags(org),
      ...semverFields,
      ...eventTags,
      ...this.getIssueAttributes(org),
    };
    return issueTags;
  },

  getState() {
    return this.state;
  },

  reset() {
    this.state = {};
    this.trigger(this.state);
  },

  loadTagsSuccess(data) {
    // Note: We could probably stop cloning the data here and just
    // assign to this.state directly, but there is a change someone may
    // be relying on referential equality somewhere in the codebase and
    // we dont want to risk breaking that.
    const newState: TagCollection = {};

    for (let i = 0; i < data.length; i++) {
      const tag = data[i];
      newState[tag.key] = {
        values: [],
        ...tag,
      };
    }

    // We will iterate through the previous tags in reverse so that previously
    // added tags are carried over first. We rely on browser implementation
    // of Object.keys() to return keys in insertion order.
    const previousTagKeys = Object.keys(this.state);

    const MAX_STORE_SIZE = 2000;
    // We will carry over the previous tags until we reach the max store size
    const toCarryOver = Math.max(0, MAX_STORE_SIZE - data.length);

    let carriedOver = 0;
    while (previousTagKeys.length > 0 && carriedOver < toCarryOver) {
      const tagKey = previousTagKeys.pop();
      if (tagKey === undefined) {
        // Should be unreachable, but just in case
        break;
      }
      // If the new state already has a previous tag then we will not carry it over
      // and use the latest tag in the store instead.
      if (newState[tagKey]) {
        continue;
      }
      // Else override the tag with the previous tag
      newState[tagKey] = this.state[tagKey];
      carriedOver++;
    }

    this.state = newState;
    this.trigger(newState);
  },
};

const TagStore = createStore(storeConfig);
export default TagStore;
