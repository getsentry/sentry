from __future__ import absolute_import

import six

from rest_framework import serializers

from sentry.models import Environment
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

        node = cls(self.context['project'], data)

        if not node.form_cls:
            return data

        form = node.get_form_instance()

        if not form.is_valid():
            # XXX(epurkhiser): Very hacky, but we really just want validation
            # errors that are more specific, not just 'this wasn't filled out',
            # give a more generic error for those.
            first_error = next(six.itervalues(form.errors))[0]

            if first_error != 'This field is required.':
                raise ValidationError(first_error)

            raise ValidationError(
                'Ensure at least one action is enabled and all required fields are filled in.'
            )

        # Update data from cleaned form values
        data.update(form.cleaned_data)

        return data


class RuleSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    environment = serializers.CharField(max_length=64, required=False, allow_none=True)
    actionMatch = serializers.ChoiceField(
        choices=(('all', 'all'), ('any', 'any'), ('none', 'none'), )
    )
    actions = ListField(
        child=RuleNodeField(type='action/event'),
    )
    conditions = ListField(
        child=RuleNodeField(type='condition/event'),
    )
    frequency = serializers.IntegerField(min_value=5, max_value=60 * 24 * 30)

    def validate_environment(self, attrs, source):
        name = attrs.get(source)
        if name is None:
            return attrs

        try:
            attrs['environment'] = Environment.get_for_organization_id(
                self.context['project'].organization_id,
                name,
            ).id
        except Environment.DoesNotExist:
            raise serializers.ValidationError(u'This environment has not been created.')

        return attrs

    def save(self, rule):
        rule.project = self.context['project']
        if 'environment' in self.data:
            rule.environment_id = self.data['environment']
        if self.data.get('name'):
            rule.label = self.data['name']
        if self.data.get('actionMatch'):
            rule.data['action_match'] = self.data['actionMatch']
        if self.data.get('actions') is not None:
            rule.data['actions'] = self.data['actions']
        if self.data.get('conditions') is not None:
            rule.data['conditions'] = self.data['conditions']
        if self.data.get('frequency'):
            rule.data['frequency'] = self.data['frequency']
        rule.save()
        return rule
