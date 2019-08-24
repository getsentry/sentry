from __future__ import absolute_import

import six

from rest_framework import serializers

from sentry.models import Environment
from sentry.rules import rules

from . import ListField

ValidationError = serializers.ValidationError


class RuleNodeField(serializers.Field):
    def __init__(self, type):
        super(RuleNodeField, self).__init__()
        self.type_name = type

    def to_representation(self, value):
        return value

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            msg = "Incorrect type. Expected a mapping, but got %s"
            raise ValidationError(msg % type(data).__name__)

        if "id" not in data:
            raise ValidationError("Missing attribute 'id'")

        cls = rules.get(data["id"], self.type_name)
        if cls is None:
            msg = "Invalid node. Could not find '%s'"
            raise ValidationError(msg % data["id"])

        node = cls(self.context["project"], data)

        if not node.form_cls:
            return data

        form = node.get_form_instance()

        if not form.is_valid():
            # XXX(epurkhiser): Very hacky, but we really just want validation
            # errors that are more specific, not just 'this wasn't filled out',
            # give a more generic error for those.
            first_error = next(six.itervalues(form.errors))[0]

            if first_error != "This field is required.":
                raise ValidationError(first_error)

            raise ValidationError(
                "Ensure at least one action is enabled and all required fields are filled in."
            )

        # Update data from cleaned form values
        data.update(form.cleaned_data)

        return data


class RuleSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    environment = serializers.CharField(max_length=64, required=False, allow_null=True)
    actionMatch = serializers.ChoiceField(
        choices=(("all", "all"), ("any", "any"), ("none", "none"))
    )
    actions = ListField(child=RuleNodeField(type="action/event"))
    conditions = ListField(child=RuleNodeField(type="condition/event"))
    frequency = serializers.IntegerField(min_value=5, max_value=60 * 24 * 30)

    def validate_environment(self, environment):
        if environment is None:
            return environment

        try:
            environment = Environment.get_for_organization_id(
                self.context["project"].organization_id, environment
            ).id
        except Environment.DoesNotExist:
            raise serializers.ValidationError(u"This environment has not been created.")

        return environment

    def validate_conditions(self, value):
        if not value:
            raise serializers.ValidationError(u"Must select a condition")
        return value

    def validate_actions(self, value):
        if not value:
            raise serializers.ValidationError(u"Must select an action")
        return value

    def save(self, rule):
        rule.project = self.context["project"]
        if "environment" in self.validated_data:
            environment = self.validated_data["environment"]
            rule.environment_id = int(environment) if environment else environment
        if self.validated_data.get("name"):
            rule.label = self.validated_data["name"]
        if self.validated_data.get("actionMatch"):
            rule.data["action_match"] = self.validated_data["actionMatch"]
        if self.validated_data.get("actions") is not None:
            rule.data["actions"] = self.validated_data["actions"]
        if self.validated_data.get("conditions") is not None:
            rule.data["conditions"] = self.validated_data["conditions"]
        if self.validated_data.get("frequency"):
            rule.data["frequency"] = self.validated_data["frequency"]
        rule.save()
        return rule
