/** @jsx React.DOM */

class PendingChangeQueue extends Array {
  constructor() {
    this.changes = [];
  }

  clear() {
    this.changes = [];
  }

  getForItem(itemId) {
    var results = [];
    this.changes.forEach(function(change){
      if (change[1] == itemId) {
        results.push(change);
      }
    });
    return results;
  }

  push(changeId, itemId, data) {
    this.changes.push([changeId, itemId, data]);
  }

  remove(changeId, itemId) {
    var newChanges = [];
    this.changes.forEach(function(change){
      if (change[0] != changeId || change[1] != itemId) {
        newChanges.push(change);
      }
    });
    this.changes = newChanges;
  }
}

module.exports = PendingChangeQueue;
