define([
  'angular'
], function(angular) {
  'use strict';

  var TEMPLATES = {
    'text': 'input-text.html',
    'select': 'input-select.html'
  };

  var DEFAULT_TEMPLATE = TEMPLATES.text;

  function titleize(string) {
    string = string.replace('_', ' ');
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  angular.module('sentry.forms', [])
    .factory('Form', function() {
      var Form = function(fields, initial){
        var field,
            fieldName;

        this._data = angular.copy(initial || {});
        this._fields = fields;

        for (fieldName in fields) {
          field = fields[fieldName];
          field.name = fieldName;
          field.value = this._data[fieldName];
          field.label = field.label || titleize(field.name);
          field.required = field.required || false;
          this[fieldName] = field;
        }
      };

      Form.prototype.isUnchanged = function(){
        var data = {},
            field,
            fieldName;

        for (fieldName in this._fields) {
          field = this._fields[fieldName];
          if (field.value != this._data[fieldName]) {
            return false;
          }
        }

        return true;
      };

      Form.prototype.getData = function(){
        var data = {},
            fieldName;

        for (fieldName in this._fields) {
          data[fieldName] = this._fields[fieldName].value;
        }
        return data;
      };

      Form.prototype.setData = function(data){
        var fieldName;

        this._data = data;
        for (fieldName in this._fields) {
          this._fields[fieldName].value = data[fieldName] || '';
        }
      };

      return Form;
    })
    .directive('formField', function() {
      return {
        restrict: 'A',
        template: '<div ng-include="fieldTemplateUrl"></div>',
        scope: {
          formField: '='
        },
        link: function(scope, element, attrs, ctrl) {
          var field = scope.formField;
          var templateName = TEMPLATES[field.type] || DEFAULT_TEMPLATE;

          scope.fieldTemplateUrl = 'templates/forms/' + templateName;
          scope.field = field;
        }
      };
    });
});
