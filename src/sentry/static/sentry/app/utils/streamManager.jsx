/*** @jsx React.DOM */

var syncUpdates = function(sm) {
  if (sm.limit && sm.length > sm.limit) {
    // TODO(dcramer): this needs to remove items from GroupListStore
    sm.splice(sm.limit, sm.length - sm.limit);
  }
};


class StreamManager {
  // TODO(dcramer): this should listen to changes on GroupListStore and remove
  // items that are removed there
  constructor(options) {
    this.idList = [];

    if (typeof options === "undefined") {
      options = {};
    }

    this.limit = options.limit || 1000;
    this.length = 0;

    return this;
  }

  push(itemIds) {
    if (!itemIds instanceof Array) {
      itemIds = [itemIds];
    }

    itemIds.forEach((id) => {
      // this needs to update the item in the global store, and ensure its
      // position in our local array
      var existing = GroupListStore.getItem(id);
      if (existing) {
        $.extend(true, existing, item);
        item = existing;
      } else {
        GroupListStore.add(id);
      }
      this.idList.push(id);
      this.length += 1;
    });
    syncUpdates(this);
    return this;
  }

  unshift(items) {
    return this.push(items.reverse());
  }
}

module.exports = StreamManager;
