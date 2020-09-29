const removeFromList = (item, list) => {
  const idx = list.indexOf(item);

  if (idx !== -1) {
    list.splice(idx, 1);
  }
};

type Options = {
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
    this.idList = [];
    this.store = store;
    this.limit = options.limit || 1000;
  }

  trim() {
    const excess = this.idList.splice(this.limit, this.idList.length - this.limit);
    excess.forEach(this.store.remove);
  }

  push(items: IdShape[] = []) {
    items = [...items];
    if (items.length === 0) {
      return this;
    }

    items = items.filter(item => item.hasOwnProperty('id'));

    items.forEach(item => removeFromList(item.id, this.idList));
    const ids = items.map(item => item.id);
    this.idList = [...this.idList, ...ids];

    this.trim();
    this.store.add(items);
    return this;
  }

  getAllItems() {
    return this.store
      .getAllItems()
      .slice()
      .sort((a, b) => this.idList.indexOf(a.id) - this.idList.indexOf(b.id));
  }

  unshift(items: IdShape[] = []) {
    items = [...items];
    if (items.length === 0) {
      return this;
    }

    items.forEach(item => removeFromList(item.id, this.idList));
    const ids = items.map(item => item.id);
    this.idList = [...ids, ...this.idList];

    this.trim();
    this.store.add(items);
    return this;
  }
}

export default StreamManager;
