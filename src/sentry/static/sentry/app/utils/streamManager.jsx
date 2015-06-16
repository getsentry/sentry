class StreamManager {
  // TODO(dcramer): this should listen to changes on GroupStore and remove
  // items that are removed there
  constructor(store, options) {
    if (typeof options === "undefined") {
      options = {};
    }

    this.idList = [];
    this.store = store;
    this.limit = options.limit || 1000;
    this.length = 0;

    return this;
  }

  trim() {
    for (var i = this.limit; i < this.length; i++) {
      this.store.remove(this.idList[i]);
    }
    this.idList.splice(this.limit, this.length - this.limit);
  }

  push(items) {
    if (!items instanceof Array) {
      items = [items];
    }
    items.forEach((item) => {
      var idx = this.idList.indexOf(item.id);
      if (idx !== -1) {
        this.idList.splice(idx, 1);
      }
      this.length += 1;
      this.idList.push(item.id);
    });
    this.trim();
    this.store.add(items);
    return this;
  }

  getAllItems() {
    var items = this.store.getAllItems();
    var itemsById = {};
    items.forEach((item) => {
      itemsById[item.id] = item;
    });

    var ordered = [];
    this.idList.forEach((itemId) => {
      if (itemsById[itemId]) {
        ordered.push(itemsById[itemId]);
      }
    });

    return ordered;
  }

  unshift(items) {
    if (!items instanceof Array) {
      items = [items];
    } else {
      items = items.reverse();
    }

    items.forEach((item) => {
      var idx = this.idList.indexOf(item.id);
      if (idx !== -1) {
        this.idList.splice(idx, 1);
      }
      this.length += 1;
      this.idList.unshift(item.id);
    });
    this.trim();
    this.store.add(items);
    return this;
  }
}

module.exports = StreamManager;
