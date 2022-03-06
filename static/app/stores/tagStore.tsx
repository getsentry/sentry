import Reflux from 'reflux';

import TagActions from 'sentry/actions/tagActions';
import {Tag, TagCollection} from 'sentry/types';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';

// This list is only used on issues. Events/discover
// have their own field list that exists elsewhere.
// contexts.key and contexts.value omitted on purpose.
const BUILTIN_TAGS = [
  'event.type',
  'platform',
  'message',
  'title',
  'location',
  'timestamp',
  'release',
  'user.id',
  'user.username',
  'user.email',
  'user.ip',
  'sdk.name',
  'sdk.version',
  'http.method',
  'http.url',
  'os.build',
  'os.kernel_version',
  'device.brand',
  'device.locale',
  'device.uuid',
  'device.model_id',
  'device.arch',
  'device.orientation',
  'geo.country_code',
  'geo.region',
  'geo.city',
  'error.type',
  'error.handled',
  'error.unhandled',
  'error.value',
  'error.mechanism',
  'stack.abs_path',
  'stack.filename',
  'stack.package',
  'stack.module',
  'stack.function',
  'stack.stack_level',
].reduce<TagCollection>((acc, tag) => {
  acc[tag] = {key: tag, name: tag};
  return acc;
}, {});

type TagStoreInterface = {
  getAllTags(): TagCollection;
  getBuiltInTags(): TagCollection;
  getIssueAttributes(): TagCollection;
  getState(): TagCollection;
  onLoadTagsSuccess(data: Tag[]): void;
  reset(): void;
  state: TagCollection;
};

const storeConfig: Reflux.StoreDefinition & TagStoreInterface = {
  state: {},

  init() {
    this.state = {};
    this.listenTo(TagActions.loadTagsSuccess, this.onLoadTagsSuccess);
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
    return {
      is: {
        key: 'is',
        name: 'Status',
        values: isSuggestions,
        maxSuggestedValues: isSuggestions.length,
        predefined: true,
      },
      has: {
        key: 'has',
        name: 'Has Tag',
        values: Object.keys(this.state),
        predefined: true,
      },
      assigned: {
        key: 'assigned',
        name: 'Assigned To',
        values: [],
        predefined: true,
      },
      bookmarks: {
        key: 'bookmarks',
        name: 'Bookmarked By',
        values: [],
        predefined: true,
      },
      lastSeen: {
        key: 'lastSeen',
        name: 'Last Seen',
        values: ['-1h', '+1d', '-1w'],
        predefined: true,
      },
      firstSeen: {
        key: 'firstSeen',
        name: 'First Seen',
        values: ['-1h', '+1d', '-1w'],
        predefined: true,
      },
      firstRelease: {
        key: 'firstRelease',
        name: 'First Release',
        values: ['latest'],
        predefined: true,
      },
      'event.timestamp': {
        key: 'event.timestamp',
        name: 'Event Timestamp',
        values: ['2017-01-02', '>=2017-01-02T01:00:00', '<2017-01-02T02:00:00'],
        predefined: true,
      },
      timesSeen: {
        key: 'timesSeen',
        name: 'Times Seen',
        isInput: true,
        // Below values are required or else SearchBar will attempt to get values // This is required or else SearchBar will attempt to get values
        values: [],
        predefined: true,
      },
      assigned_or_suggested: {
        key: 'assigned_or_suggested',
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

  getState() {
    return this.state;
  },

  getAllTags() {
    return this.state;
  },

  onLoadTagsSuccess(data) {
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

const TagStore = Reflux.createStore(storeConfig) as Reflux.Store & TagStoreInterface;

export default TagStore;
