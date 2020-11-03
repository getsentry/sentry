import Reflux from 'reflux';

import {Tag, TagCollection} from 'app/types';
import TagActions from 'app/actions/tagActions';

// This list is only used on issues. Events/discover
// have their own field list that exists elsewhere.
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
  'contexts.key',
  'contexts.value',
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
  state: TagCollection;
  getBuiltInTags: () => TagCollection;
  getIssueAttributes: () => TagCollection;
  getAllTags: () => TagCollection;
  reset: () => void;
  onLoadTagsSuccess: (data: Tag[]) => void;
};

const tagStoreConfig: Reflux.StoreDefinition & TagStoreInterface = {
  state: {},

  init() {
    this.state = {};
    this.listenTo(TagActions.loadTagsSuccess, this.onLoadTagsSuccess);
  },

  getBuiltInTags() {
    return {...BUILTIN_TAGS};
  },

  getIssueAttributes() {
    // TODO(mitsuhiko): what do we do with translations here?
    return {
      is: {
        key: 'is',
        name: 'Status',
        values: [
          'resolved',
          'unresolved',
          'ignored',
          // TODO(dcramer): remove muted once data is migrated and 9.0+
          'muted',
          'assigned',
          'unassigned',
        ],
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
    };
  },

  reset() {
    this.state = {};
    this.trigger(this.state);
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

type TagStore = Reflux.Store & TagStoreInterface;

export default Reflux.createStore(tagStoreConfig) as TagStore;
