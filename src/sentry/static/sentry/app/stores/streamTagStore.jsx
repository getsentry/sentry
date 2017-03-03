import Reflux from 'reflux';
import _ from 'underscore';

import StreamTagActions from '../actions/streamTagActions';
import MemberListStore from './memberListStore';

const getMemberListStoreUsernames = () => {
  return MemberListStore.getAll().map(user => user.username || user.email);
};

const StreamTagStore = Reflux.createStore({
  listenables: StreamTagActions,

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
          'unassigned'
        ],
        predefined: true
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
        predefined: true
      },
      bookmarks: {
        key: 'bookmarks',
        name: 'Bookmarked By',
        values: getMemberListStoreUsernames(),
        predefined: true
      }
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
    Object.assign(this.tags, _.reduce(data, (obj, tag) => {

      tag = Object.assign({
        values: []
      }, tag);

      let old = this.tags[tag.key];

      // Don't override predefined filters (e.g. "is")
      if (!old || !old.predefined)
        obj[tag.key] = tag;

      return obj;
    }, {}));
    this.tags.has.values = data.map(tag => tag.key);
    this.trigger(this.tags);
  },

  onMemberListStoreChange(members) {
    let assignedTag = this.tags.assigned;
    assignedTag.values = getMemberListStoreUsernames();
    assignedTag.values.unshift('me');
    this.tags.bookmarks.values = assignedTag.values;
    this.trigger(this.tags);
  }
});

export default StreamTagStore;
