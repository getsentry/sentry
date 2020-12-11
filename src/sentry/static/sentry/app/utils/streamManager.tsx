import GroupStore from 'app/stores/groupStore';

/**
 * Currently only used with GroupStore
 */
type Stores = typeof GroupStore;
type AddItems = Parameters<Stores['add']>[0];

type Options = {
  /** Max number of items to keep at once */
  limit?: number;
};

class StreamManager {
  private idList: string[] = [];
  private limit: number;

  // TODO(dcramer): this should listen to changes on GroupStore and remove
  // items that are removed there
  constructor(private store: Stores, options: Options = {}) {
    this.limit = options.limit || 100;
  }

  trim() {
    if (this.limit > this.idList.length) {
      return;
    }

    const excess = this.idList.splice(this.limit, this.idList.length - this.limit);
    this.store.remove(excess);
  }

  push(items: AddItems = []) {
    items = Array.isArray(items) ? items : [items];
    if (items.length === 0) {
      return;
    }

    items = items.filter(item => item.hasOwnProperty('id'));
    const ids = items.map(item => item.id);
    this.idList = this.idList.filter(id => !ids.includes(id));
    this.idList = [...this.idList, ...ids];

    this.trim();
    this.store.add(items);
  }

  getAllItems() {
    return this.store
      .getAllItems()
      .slice()
      .sort((a, b) => this.idList.indexOf(a.id) - this.idList.indexOf(b.id));
  }

  unshift(items: AddItems = []) {
    items = Array.isArray(items) ? items : [items];
    if (items.length === 0) {
      return;
    }

    const ids = items.map(item => item.id);
    this.idList = this.idList.filter(id => !ids.includes(id));
    this.idList = [...ids, ...this.idList];

    this.trim();
    this.store.add(items);
  }
}

export default StreamManager;
