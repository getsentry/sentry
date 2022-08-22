type Options = {
  /** Max number of items to keep at once */
  limit?: number;
};

/**
 * Minimal type shape for objects that can be managed inside StreamManager.
 */
type IdShape = {
  id: string;
};

class StreamManager {
  private idList: string[] = [];
  private limit: number;
  private store: any;

  // TODO(dcramer): this should listen to changes on GroupStore and remove
  // items that are removed there
  // TODO(ts) Add better typing for store. Generally this is GroupStore, but it could be other things.
  constructor(store: any, options: Options = {}) {
    this.store = store;
    this.limit = options.limit || 100;
  }

  reset() {
    this.idList = [];
  }

  trim() {
    if (this.limit > this.idList.length) {
      return;
    }

    const excess = this.idList.splice(this.limit, this.idList.length - this.limit);
    this.store.remove(excess);
  }

  push(items: IdShape | IdShape[] = []) {
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

  unshift(items: IdShape | IdShape[] = []) {
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
