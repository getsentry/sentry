
var Reflux = require("reflux");

var BreadcrumbStore = Reflux.createStore({
  init() {
    this.RESERVATION = -1;
    this.counter = 0;
    this.nodes = [];
  },

  push(node) {
    // Create a unique ID for this node, append it to the list
    // and return the ID.
    this.counter += 1;
    this.nodes.push([this.counter, node]);
    this.trigger();
    return this.counter;
  },

  pop(idx) {
    this.nodes = this.nodes.filter((node) => {
      return node[0] !== idx;
    });
    this.trigger();
  },

  update(idx, node) {
    for (var i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i][0] === idx) {
        this.nodes[i][1] = node;
        this.trigger();
        return true;
      }
    }
    return false;
  },

  reserve() {
    return this.push(this.RESERVATION);
  },

  getNodes() {
    var nodes = [];
    for (var i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i][1] == this.RESERVATION) {
        break;
      }
      nodes.push(this.nodes[i][1]);
    }
    return nodes;
  }
});

module.exports = BreadcrumbStore;
