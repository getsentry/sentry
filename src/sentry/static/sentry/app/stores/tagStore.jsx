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

const getMemberListStoreUsernames = () => {
  return MemberListStore.getAll().map(getUsername);
};

const TagStore = Reflux.createStore({
  listenables: TagActions,

  init() {
    this.listenTo(MemberListStore, this.onMemberListStoreChange);
    this.reset();
  },

  reset() {
    // TODO(mitsuhiko): what do we do with translations here?
    this.tags = {
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

    this.trigger(this.tags);
  },

  getTag(tagName) {
    return this.tags[tagName];
  },

  getAllTags() {
    return this.tags;
  },

  getTagKeys() {
    return Object.keys(this.tags);
  },

  getTagValues(tagKey, query) {
    return this.tags[tagKey].values || [];
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

  onMemberListStoreChange(members) {
    const assignedTag = this.tags.assigned;
    assignedTag.values = getMemberListStoreUsernames();
    assignedTag.values.unshift('me');
    this.tags.bookmarks.values = assignedTag.values;
    this.trigger(this.tags);
  },
});

export default TagStore;
