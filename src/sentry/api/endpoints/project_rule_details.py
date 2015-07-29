from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Rule
from sentry.rules import rules


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


class ListField(serializers.WritableField):
    def __init__(self, child):
        self.child = child
        super(ListField, self).__init__()

    def initialize(self, **kwargs):
        super(ListField, self).initialize(**kwargs)
        self.child.initialize(**kwargs)

    def to_native(self, obj):
        return obj

    def from_native(self, data):
        if not isinstance(data, list):
            msg = 'Incorrect type. Expected a mapping, but got %s'
            raise ValidationError(msg % type(data).__name__)

        return map(self.child.from_native, data)


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


class ProjectRuleDetailsEndpoint(ProjectEndpoint):
    def get(self, request, project, rule_id):
        """
        Retrieve a rule

        Return details on an individual rule.

            {method} {path}

        """
        rule = Rule.objects.get(
            project=project,
            id=rule_id,
        )
        return Response(serialize(rule, request.user))

    def put(self, request, project, rule_id):
        """
        Update a rule

        Update various attributes for the given rule.

            {method} {path}
            {{
              "name": "My rule name",
              "conditions": [],
              "actions": [],
              "actionMatch": "all"
            }}

        """
        rule = Rule.objects.get(
            project=project,
            id=rule_id,
        )
        serializer = RuleSerializer({
            'actionMatch': rule.data.get('action_match', 'all'),
        }, context={'project': project}, data=request.DATA, partial=True)

        if serializer.is_valid():
            rule = serializer.save(rule=rule)

            return Response(serialize(rule, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
