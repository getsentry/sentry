class PendingChangeQueue {
  constructor() {
    this.changes = [];
  }

  getForItem(itemId) {
    return this.changes.filter(change => change[1] === itemId);
  }

  push(changeId, itemId, data) {
    this.changes.push([changeId, itemId, data]);
  }

  remove(changeId, itemId) {
    this.changes = this.changes.filter(
      change => change[0] !== changeId || change[1] !== itemId
    );
  }

  forEach() {
    this.changes.forEach.apply(this.changes, arguments);
  }
}

export default PendingChangeQueue;
