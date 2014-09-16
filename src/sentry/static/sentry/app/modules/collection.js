(function(){
  'use strict';

  angular.module('sentry.collection', [])
    .factory('Collection', function(){
      var defaults = {
        sortFunc: null,
        limit: null,
        equals: function(item, other) {
          return item.id == other.id;
        },
        canUpdate: function(current, pending) {
          return true;
        }
      };

      function Collection(collection, options) {
        var i;

        Array.call(this);

        if (options === undefined) {
          options = {};
        }

        for (i in defaults) {
          if (options[i] === undefined) {
            options[i] = defaults[i];
          }
        }

        this.options = options;

        if (collection !== undefined) {
          this.extend(collection);
        }

        return this;
      }

      Collection.prototype = [];

      Collection.prototype.constructor = Collection;

      Collection.prototype.add = function add(item) {
        if (this._updateExisting(item)) {
          return;
        }

        Array.prototype.push.apply(this, arguments);
        if (this.options.sortFunc) {
          this.options.sortFunc(this);
        }
        if (this.options.limit && this.length > this.options.limit) {
          this.splice(this.options.limit, this.length - this.options.limit);
        }
      };

      Collection.prototype.remove = function remove(item) {
        for (var i = 0; i < this.length; i++) {
          if (this[i].id == item.id) {
            this.splice(i, i + 1);
            return;
          }
        }
      };

      Collection.prototype.empty = function empty() {
        while (this.length > 0) {
          this.pop();
        }
      };

      Collection.prototype.extend = function extend(data) {
        for (var i = 0; i < data.length; i++) {
          this.add(data[i]);
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

      Collection.prototype._updateExisting = function _updateExisting(item) {
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

      return Collection;
    });
}());
