from __future__ import absolute_import

from rest_framework import serializers

from sentry.rules import rules

from . import ListField

ValidationError = serializers.ValidationError


class RuleNodeField(serializers.WritableField):
    def __init__(self, type):
        super(RuleNodeField, self).__init__()
        self.type_name = type

    def to_native(self, obj):
        return obj

    def from_native(self, data):
        if not isinstance(data, dict):
            msg = 'Incorrect type. Expected a mapping, but got %s'
            raise ValidationError(msg % type(data).__name__)

        if 'id' not in data:
            raise ValidationError("Missing attribute 'id'")

        cls = rules.get(data['id'], self.type_name)
        if cls is None:
            msg = "Invalid node. Could not find '%s'"
            raise ValidationError(msg % data['id'])

        if not cls(self.context['project'], data).validate_form():
            raise ValidationError('Node did not pass validation')

        return data


class RuleSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    actionMatch = serializers.ChoiceField(choices=(
        ('all', 'all'),
        ('any', 'any'),
        ('none', 'none'),
    ))
    actions = ListField(
        child=RuleNodeField(type='action/event'),
    )
    conditions = ListField(
        child=RuleNodeField(type='condition/event'),
    )

    def save(self, rule):
        rule.project = self.context['project']
        if self.data.get('name'):
            rule.label = self.data['name']
        if self.data.get('actionMatch'):
            rule.data['action_match'] = self.data['actionMatch']
        if self.data.get('actions') is not None:
            rule.data['actions'] = self.data['actions']
        if self.data.get('conditions') is not None:
            rule.data['conditions'] = self.data['conditions']
        rule.save()
        return rule
