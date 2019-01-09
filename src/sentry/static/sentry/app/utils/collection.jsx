import $ from 'jquery';
import _ from 'lodash';

let defaults = {
  limit: null,
  key: function(item) {
    return item.id;
  },
};

function Collection(collection, options) {
  let i;

  Array.call(this);

  if (_.isUndefined(options)) {
    options = {};
  }

  for (i in defaults) {
    if (_.isUndefined(options[i])) {
      options[i] = defaults[i];
    }
  }

  this.options = options;

  if (!_.isUndefined(collection)) {
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
  if (!_.isArray(items)) {
    items = [items];
  }

  items.forEach(
    function(item) {
      let existing = this.pop(item);
      if (existing) {
        $.extend(true, existing, item);
        item = existing;
      }
      Array.prototype.push.apply(this, [item]);
    }.bind(this)
  );
  this._refresh();
  return this;
};

Collection.prototype.unshift = function unshift(items) {
  if (!_.isArray(items)) {
    items = [items];
  }
  items.reverse().forEach(
    function(item) {
      let existing = this.pop(item);
      if (existing) {
        $.extend(true, existing, item);
        item = existing;
      }
      Array.prototype.unshift.apply(this, [item]);
    }.bind(this)
  );
  this._refresh();
  return this;
};

Collection.prototype.get = function get(key) {
  let idx = this.indexOf(key);
  if (idx === -1) {
    return null;
  }
  return this[idx];
};

Collection.prototype.pop = function pop(item) {
  let idx = this.indexOf(this.options.key(item));
  if (idx === -1) {
    return null;
  }
  let result = this[idx];
  this.splice(idx, idx + 1);
  return result;
};

Collection.prototype.empty = function empty() {
  this.splice(0, 0);
};

Collection.prototype.indexOf = function indexOf(key) {
  let keyFunc = this.options.key;
  for (let i = 0; i < this.length; i++) {
    if (keyFunc(this[i]) === key) {
      return i;
    }
  }
  return -1;
};

Collection.prototype.update = function update(item) {
  // returns true if the item already existed and was updated (as configured)
  let existing = this.indexOf(this.options.key(item));
  if (existing !== -1) {
    $.extend(true, this[existing], item);
    return true;
  }
  return false;
};

export default Collection;
