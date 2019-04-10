import $ from 'jquery';
import {isArray, isUndefined} from 'lodash';

const defaults = {
  limit: null,
  key: function(item) {
    return item.id;
  },
};

function Collection(collection, options) {
  let i;

  Array.call(this);

  if (isUndefined(options)) {
    options = {};
  }

  for (i in defaults) {
    if (isUndefined(options[i])) {
      options[i] = defaults[i];
    }
  }

  this.options = options;

  if (!isUndefined(collection)) {
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
  if (!isArray(items)) {
    items = [items];
  }

  items.forEach(
    function(item) {
      const existing = this.pop(item);
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
  if (!isArray(items)) {
    items = [items];
  }
  items.reverse().forEach(
    function(item) {
      const existing = this.pop(item);
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
  const idx = this.indexOf(key);
  if (idx === -1) {
    return null;
  }
  return this[idx];
};

Collection.prototype.pop = function pop(item) {
  const idx = this.indexOf(this.options.key(item));
  if (idx === -1) {
    return null;
  }
  const result = this[idx];
  this.splice(idx, idx + 1);
  return result;
};

Collection.prototype.empty = function empty() {
  this.splice(0, 0);
};

Collection.prototype.indexOf = function indexOf(key) {
  const keyFunc = this.options.key;
  for (let i = 0; i < this.length; i++) {
    if (keyFunc(this[i]) === key) {
      return i;
    }
  }
  return -1;
};

Collection.prototype.update = function update(item) {
  // returns true if the item already existed and was updated (as configured)
  const existing = this.indexOf(this.options.key(item));
  if (existing !== -1) {
    $.extend(true, this[existing], item);
    return true;
  }
  return false;
};

export default Collection;
