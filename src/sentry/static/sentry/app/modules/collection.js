define(['angular'], function(angular) {
  'use strict';

  angular.module('sentry.collection', [])
    .factory('Collection', function(){
      var defaults = {
        sortFunc: null,
        limit: null
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
          for (i=0; i<collection.length; i++) {
            this.push(collection[i]);
          }
        }

        return this;
      }

      Collection.prototype = [];

      Collection.prototype.constructor = Collection;

      // TODO(dcramer): we should probably make the behavior in updateItem actually
      // be part of push/unshift
      Collection.prototype.push = function push(item) {
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

      Collection.prototype.unshift = function unshift(item) {
        if (this._updateExisting(item)) {
          return;
        }

        Array.prototype.unshift.apply(this, arguments);
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

      Collection.prototype._updateExisting = function _updateExisting(item) {
        for (var i = 0; i < this.length; i++) {
          if (this[i].id == item.id) {
            angular.extend(this[i], item);
            return true;
          }
        }
        return false;
      };

      return Collection;
    });
});
