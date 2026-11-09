import {createStore} from 'zustand/vanilla';

import type {Tag, TagCollection} from 'sentry/types/group';

const MAX_STORE_SIZE = 2000;

const store = createStore<TagCollection>()(() => ({}));

export const TagStore = {
  // State is only written through the methods below.
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  reset(): void {
    // Replace the whole state instead of merging into the previous tags
    store.setState({}, true);
  },

  loadTagsSuccess(data: readonly Tag[]): void {
    // Note: We could probably stop cloning the data here and just
    // assign to the state directly, but there is a chance someone may
    // be relying on referential equality somewhere in the codebase and
    // we dont want to risk breaking that.
    const newState: TagCollection = {};

    for (const tag of data) {
      newState[tag.key] = {
        values: [],
        ...tag,
      };
    }

    // We will carry over the previous tags until we reach the max store size
    const toCarryOver = Math.max(0, MAX_STORE_SIZE - data.length);

    // We will iterate through the previous tags in reverse so that previously
    // added tags are carried over first. Object.entries() returns non-numeric
    // keys in insertion order, numeric keys come first in ascending order.
    let carriedOver = 0;
    for (const [tagKey, tag] of Object.entries(store.getState()).reverse()) {
      if (carriedOver >= toCarryOver) {
        break;
      }
      // If the new state already has a previous tag then we will not carry it over
      // and use the latest tag in the store instead.
      if (newState[tagKey]) {
        continue;
      }
      newState[tagKey] = tag;
      carriedOver++;
    }

    store.setState(newState, true);
  },
};
