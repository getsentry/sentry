(function(){
  'use strict';

  var RuleEditor = function(el, data){
    var self = this;

    this.actions_by_id = {};
    this.conditions_by_id = {};
    this.el = $(el);

    this.action_sel = this.el.find('select[id="action-select"]');
    this.action_table = this.el.find('table.action-list');
    this.action_table_body = this.action_table.find('tbody');
    this.condition_sel = this.el.find('select[id="condition-select"]');
    this.condition_table = this.el.find('table.condition-list');
    this.condition_table_body = this.condition_table.find('tbody');

    this.action_sel[0].selectize.load(function(callback) {
      callback($.map(data.actions, function(item){
        self.actions_by_id[item.id] = item;
        return {text: item.label, value: item.id};
      }));
    });

    this.condition_sel[0].selectize.load(function(callback) {
      callback($.map(data.conditions, function(item){
        self.conditions_by_id[item.id] = item;
        return {text: item.label, value: item.id};
      }));
    });

    this.action_sel.change(function(){
      var val = $(this).val();
      if (val) {
        self.addAction(val);
      }
    });
    this.condition_sel.change(function(){
      var val = $(this).val();
      if (val) {
        self.addCondition(val);
      }
    });

    this.parseFormData(data.formData, data.formErrors);
  };

  RuleEditor.prototype.parseFormData = function(form_data, form_errors) {
    // start by parsing into condition/action bits
    var data = {
      action: {},
      action_match: form_data.action_match || 'all',
      condition: {},
      label: form_data.label || ''
    }, self = this;

    form_errors = form_errors || {};

    $.each(form_data, function(key, value){
      var matches = key.match(/^(condition|action)\[(\d+)\]\[(.+)\]$/);
      var type, num;
      if (!matches) {
        return;
      }
      type = matches[1];
      num = matches[2];
      if (data[type][num] === undefined) {
        data[type][num] = {};
      }
      data[type][num][matches[3]] = value;
    });

    this.el.find('input[name=label]').val(data.label);
    this.el.find('select[name="action_match"]').val(data.action_match);

    $.each(data.condition, function(num, item){
      self.addCondition(item.id, item, form_errors['condition[' + num + ']'] || false);
    });
    $.each(data.action, function(num, item){
      self.addAction(item.id, item, form_errors['action[' + num + ']'] || false);
    });
  };

  RuleEditor.prototype.addCondition = function(id, options, has_errors) {
    var node = this.conditions_by_id[id],
    row = $('<tr></tr>'),
    remove_btn = $('<button class="btn btn-default btn-sm"><span class="icon-trash"></span></button>'),
    num = this.condition_table_body.find('tr').length,
    html = $('<div>' + node.html + '</div>'),
    prefix = 'condition[' + num + ']',
    id_field = $('<input type="hidden" name="' + prefix + '[id]" value="' + node.id + '">');

    has_errors = has_errors || false;
    options = options || {};

    if (has_errors) {
      row.addClass('error');
    }

    html.find('select').selectize();

    // we need to update the id of all form elements
    html.find('input, select, textarea').each(function(_, el){
      var $el = $(el),
      name = $el.attr('name');
      $el.attr('name', prefix + '[' + name + ']');
      $el.val(options[name] || '');
    });
    row.append($('<td></td>').append(html).append(id_field));
    row.append($('<td class="align-right"></td>').append(remove_btn));
    row.appendTo(this.condition_table_body);

    remove_btn.click(function(){
      row.remove();
      return false;
    });

    this.condition_sel.data("selectize").clear();
    this.condition_table.show();
  };

  RuleEditor.prototype.addAction = function(id, options, has_errors) {
    var node = this.actions_by_id[id],
    row = $('<tr></tr>'),
    remove_btn = $('<button class="btn btn-default btn-sm"><span class="icon-trash"></span></button>'),
    num = this.action_table_body.find('tr').length,
    html = $('<div>' + node.html + '</div>'),
    prefix = 'action[' + num + ']',
    id_field = $('<input type="hidden" name="' + prefix + '[id]" value="' + node.id + '">');

    has_errors = has_errors || false;
    options = options || {};

    if (has_errors) {
      row.addClass('error');
    }

    html.find('select').selectize();

    // we need to update the id of all form elements
    html.find('input, select, textarea').each(function(_, el){
      var $el = $(el),
      name = $el.attr('name');
      $el.attr('name', prefix + '[' + name + ']');
      $el.val(options[name] || '');
    });
    row.append($('<td></td>').append(html).append(id_field));
    row.append($('<td class="align-right"></td>').append(remove_btn));
    row.appendTo(this.action_table_body);

    remove_btn.click(function(){
      row.remove();
      return false;
    });

    this.action_sel.data("selectize").clear();
    this.action_table.show();
  };

  SentryApp.controller('EditProjectRuleCtrl', ['$scope', function($scope){
    // TODO(dcramer): we need to clean this up somehow
    new RuleEditor(document.forms.editRuleForm,
                   window.SentryApp.ruleData);
  }]);

}());
