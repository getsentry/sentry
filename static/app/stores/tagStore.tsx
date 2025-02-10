import {createStore} from 'reflux';

import type {Tag, TagCollection} from 'sentry/types/group';

import type {StrictStoreDefinition} from './types';

interface TagStoreDefinition extends StrictStoreDefinition<TagCollection> {
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

    for (const tag of data) {
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
      newState[tagKey] = this.state[tagKey]!;
      carriedOver++;
    }

    this.state = newState;
    this.trigger(newState);
  },
};

const TagStore = createStore(storeConfig);
export default TagStore;
