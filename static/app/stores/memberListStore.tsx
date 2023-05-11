import {createStore, StoreDefinition} from 'reflux';

import {User} from 'sentry/types';

type State = {
  cursor: string | null;
  hasMore: boolean | null;
  loading: boolean;
  members: User[];
};

// XXX(epurkhiser): Either this store is completely wrong, or it is misnamed, a
// `Member` has one `User`, this stores users not members.

interface MemberListStoreDefinition extends StoreDefinition {
  getAll(): User[];
  getById(memberId: string): User | undefined;
  getState(): State;
  init(): void;
  loadInitialData(items: User[], hasMore?: boolean | null, cursor?: string | null): void;
  reset(): void;
  state: State;
}

const storeConfig: MemberListStoreDefinition = {
  state: {
    members: [],
    loading: true,
    hasMore: null,
    cursor: null,
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.state = {
      members: [],
      loading: true,
      hasMore: null,
      cursor: null,
    };
  },

  loadInitialData(items: User[], hasMore, cursor) {
    this.state = {
      members: items,
      loading: false,
      hasMore: hasMore ?? this.state.hasMore,
      cursor: cursor ?? this.state.cursor,
    };

    this.trigger(this.state, 'initial');
  },

  getById(memberId) {
    return this.state.members.find(({id}) => memberId === id);
  },

  getAll() {
    return this.state.members;
  },

  getState() {
    return this.state;
  },
};

const MemberListStore = createStore(storeConfig);
export default MemberListStore;
