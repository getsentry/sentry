import Reflux from 'reflux';
import reduce from 'lodash/reduce';

import TagActions from 'app/actions/tagActions';
import MemberListStore from 'app/stores/memberListStore';

const uuidPattern = /[0-9a-f]{32}$/;

const getUsername = ({isManaged, username, email}) => {
  // Users created via SAML receive unique UUID usernames. Use
  // their email in these cases, instead.
  if (username && uuidPattern.test(username)) {
    return email;
  } else {
    return !isManaged && username ? username : email;
  }
};

const getMemberListStoreUsernames = () => MemberListStore.getAll().map(getUsername);

// This list is not the same as the list of
// fields in app/utils/discover/fields.tsx@FIELDS
// The differences are because discover1 and issue
// search expose a subset of all event attributes.
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
  'error.value',
  'error.mechanism',
  'error.handled',
  'stack.abs_path',
  'stack.filename',
  'stack.package',
  'stack.module',
  'stack.function',
  'stack.stack_level',
].map(tag => ({
  key: tag,
}));

const TagStore = Reflux.createStore({
  listenables: TagActions,

  init() {
    this.listenTo(MemberListStore, this.onMemberListStoreChange);
    this.reset();
  },

  getBuiltInTags() {
    return [...BUILTIN_TAGS];
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
        values: [],
        predefined: true,
      },
      assigned: {
        key: 'assigned',
        name: 'Assigned To',
        values: getMemberListStoreUsernames(),
        predefined: true,
      },
      bookmarks: {
        key: 'bookmarks',
        name: 'Bookmarked By',
        values: getMemberListStoreUsernames(),
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
    this.tags = this.getIssueAttributes();

    this.trigger(this.tags);
  },

  getAllTags() {
    return this.tags;
  },

  onLoadTagsSuccess(data) {
    Object.assign(
      this.tags,
      reduce(
        data,
        (obj, tag) => {
          tag = Object.assign(
            {
              values: [],
            },
            tag
          );

          const old = this.tags[tag.key];

          // Don't override predefined filters (e.g. "is")
          if (!old || !old.predefined) {
            obj[tag.key] = tag;
          }

          return obj;
        },
        {}
      )
    );
    this.tags.has.values = data.map(tag => tag.key);
    this.trigger(this.tags);
  },

  onMemberListStoreChange() {
    const assignedTag = this.tags.assigned;
    assignedTag.values = getMemberListStoreUsernames();
    assignedTag.values.unshift('me');
    this.tags.bookmarks.values = assignedTag.values;
    this.trigger(this.tags);
  },
});

export default TagStore;
