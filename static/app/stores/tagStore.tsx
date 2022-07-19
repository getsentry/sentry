import {createStore} from 'reflux';

import {Tag, TagCollection} from 'sentry/types';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import {FieldKey, ISSUE_FIELDS} from 'sentry/utils/fields';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

// This list is only used on issues. Events/discover
// have their own field list that exists elsewhere.
// contexts.key and contexts.value omitted on purpose.
const BUILTIN_TAGS = ISSUE_FIELDS.reduce<TagCollection>((acc, tag) => {
  acc[tag] = {key: tag, name: tag};
  return acc;
}, {});

interface TagStoreDefinition extends CommonStoreDefinition<TagCollection> {
  getAllTags(): TagCollection;
  getBuiltInTags(): TagCollection;
  getIssueAttributes(): TagCollection;
  loadTagsSuccess(data: Tag[]): void;
  reset(): void;
  state: TagCollection;
}

const storeConfig: TagStoreDefinition = {
  state: {},
  unsubscribeListeners: [],

  init() {
    this.state = {};
  },

  getBuiltInTags() {
    return {...BUILTIN_TAGS, ...SEMVER_TAGS};
  },

  getIssueAttributes() {
    // TODO(mitsuhiko): what do we do with translations here?
    const isSuggestions = [
      'resolved',
      'unresolved',
      'ignored',
      'assigned',
      'for_review',
      'unassigned',
      'linked',
      'unlinked',
    ];

    const sortedTagKeys = Object.keys(this.state).sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    return {
      [FieldKey.IS]: {
        key: FieldKey.IS,
        name: 'Status',
        values: isSuggestions,
        maxSuggestedValues: isSuggestions.length,
        predefined: true,
      },
      [FieldKey.HAS]: {
        key: FieldKey.HAS,
        name: 'Has Tag',
        values: sortedTagKeys,
        predefined: true,
      },
      [FieldKey.ASSIGNED]: {
        key: FieldKey.ASSIGNED,
        name: 'Assigned To',
        values: [],
        predefined: true,
      },
      [FieldKey.BOOKMARKS]: {
        key: FieldKey.BOOKMARKS,
        name: 'Bookmarked By',
        values: [],
        predefined: true,
      },
      [FieldKey.LAST_SEEN]: {
        key: FieldKey.LAST_SEEN,
        name: 'Last Seen',
        values: ['-1h', '+1d', '-1w'],
        predefined: true,
      },
      [FieldKey.FIRST_SEEN]: {
        key: FieldKey.FIRST_SEEN,
        name: 'First Seen',
        values: ['-1h', '+1d', '-1w'],
        predefined: true,
      },
      [FieldKey.FIRST_RELEASE]: {
        key: FieldKey.FIRST_RELEASE,
        name: 'First Release',
        values: ['latest'],
        predefined: true,
      },
      [FieldKey.EVENT_TIMESTAMP]: {
        key: FieldKey.EVENT_TIMESTAMP,
        name: 'Event Timestamp',
        values: ['2017-01-02', '>=2017-01-02T01:00:00', '<2017-01-02T02:00:00'],
        predefined: true,
      },
      [FieldKey.TIMES_SEEN]: {
        key: FieldKey.TIMES_SEEN,
        name: 'Times Seen',
        isInput: true,
        // Below values are required or else SearchBar will attempt to get values // This is required or else SearchBar will attempt to get values
        values: [],
        predefined: true,
      },
      [FieldKey.ASSIGNED_OR_SUGGESTED]: {
        key: FieldKey.ASSIGNED_OR_SUGGESTED,
        name: 'Assigned or Suggested',
        isInput: true,
        values: [],
        predefined: true,
      },
    };
  },

  reset() {
    this.state = {};
    this.trigger(this.state);
  },

  getAllTags() {
    return this.state;
  },

  getState() {
    return this.getAllTags();
  },

  loadTagsSuccess(data) {
    const newTags = data.reduce<TagCollection>((acc, tag) => {
      acc[tag.key] = {
        values: [],
        ...tag,
      };

      return acc;
    }, {});

    this.state = {...this.state, ...newTags};
    this.trigger(this.state);
  },
};

const TagStore = createStore(makeSafeRefluxStore(storeConfig));
export default TagStore;
