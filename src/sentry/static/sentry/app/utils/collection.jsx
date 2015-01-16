/*** @jsx React.DOM */

var defaults = {
  limit: null,
  equals: function(item, other) {
    return item.id == other.id;
  }
};

function Collection(collection, options) {
  var i;

  Array.call(this);

  if (typeof options === "undefined") {
    options = {};
  }

  for (i in defaults) {
    if (typeof options[i] !== "undefined") {
      options[i] = defaults[i];
    }
  }

  this.options = options;

  if (typeof collection !== "undefined") {
    this.push(collection);
  }

  return this;
}

Collection.prototype = [];

Collection.prototype.constructor = Collection;

Collection.prototype._refresh = function _refresh() {
  if (this.options.limit && this.length > this.options.limit) {
    this.splice(this.options.limit, this.length - this.options.limit);
  }
};

Collection.prototype.push = function push(items) {
  if (!items instanceof Array) {
    items = [items];
  }

  items.forEach(function(item){
    var existing = this.pop(item);
    if (existing) {
      $.extend(true, existing, item);
      item = existing;
    }
    Array.prototype.push.apply(this, [item]);
  }.bind(this));
  this._refresh();
  return this;
};

Collection.prototype.unshift = function unshift(items) {
  if (!items instanceof Array) {
    items = [items];
  }
  items.reverse().forEach(function(item){
    var existing = this.pop(item);
    if (existing) {
      $.extend(true, existing, item);
      item = existing;
    }
    Array.prototype.unshift.apply(this, [item]);
  }.bind(this));
  this._refresh();
  return this;
};

Collection.prototype.pop = function pop(item) {
  var idx = this.indexOf(item);
  if (idx === -1) {
    return;
  }
  result = this[idx];
  this.splice(idx, idx + 1);
  return result;
};

Collection.prototype.empty = function empty() {
  while (this.length > 0) {
    this.pop();
  }
};

Collection.prototype.indexOf = function indexOf(item) {
  for (var i = 0; i < this.length; i++) {
    if (this.options.equals(this[i], item)) {
      return i;
    }
  }
  return -1;
};

Collection.prototype.update = function update(item) {
  // returns true if the item already existed and was updated (as configured)
  var existing = this.indexOf(item);
  if (existing !== -1) {
    if (!this.options.canUpdate(this[existing], item)) {
      return true;
    }
    $.extend(true, this[existing], item);
    return true;
  }
  return false;
};

module.exports = Collection;
