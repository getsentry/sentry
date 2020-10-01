from __future__ import absolute_import

import six

from rest_framework import serializers

from sentry import features
from sentry.constants import MIGRATED_CONDITIONS
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

            raise ValidationError("Ensure all required fields are filled in.")

        # Update data from cleaned form values
        data.update(form.cleaned_data)

        if getattr(form, "_pending_save", False):
            data["pending_save"] = True
        return data


class RuleSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    environment = serializers.CharField(max_length=64, required=False, allow_null=True)
    actionMatch = serializers.ChoiceField(
        choices=(("all", "all"), ("any", "any"), ("none", "none"))
    )
    filterMatch = serializers.ChoiceField(
        choices=(("all", "all"), ("any", "any"), ("none", "none")), required=False
    )
    actions = ListField(child=RuleNodeField(type="action/event"))
    conditions = ListField(child=RuleNodeField(type="condition/event"), required=False)
    filters = ListField(child=RuleNodeField(type="filter/event"), required=False)
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

    def validate_actions(self, value):
        if not value:
            raise serializers.ValidationError(u"Must select an action.")
        return value

    def validate(self, attrs):
        # XXX(meredith): For rules that have the Slack integration as an action
        # we need to check if the channel_id needs to be looked up via an async task.
        # If the "pending_save" attribute is set we want to bubble that up to the
        # project_rule(_details) endpoints by setting it on attrs
        actions = attrs.get("actions", tuple())
        for action in actions:
            # remove this attribute because we don't want it to be saved in the rule
            if action.pop("pending_save", None):
                attrs["pending_save"] = True
                break

        # ensure that if filters are passed in that a filterMatch is also supplied
        filters = attrs.get("filters")
        if filters:
            filter_match = attrs.get("filterMatch")
            if not filter_match:
                raise serializers.ValidationError(
                    {
                        "filterMatch": u"Must select a filter match (all, any, none) if filters are supplied."
                    }
                )

        # ensure that if a user has alert-filters enabled, they do not use old conditions
        project = self.context["project"]
        conditions = attrs.get("conditions", tuple())
        project_has_filters = features.has("projects:alert-filters", project)
        if project_has_filters:
            old_conditions = [
                condition for condition in conditions if condition["id"] in MIGRATED_CONDITIONS
            ]
            if old_conditions:
                raise serializers.ValidationError(
                    {
                        "conditions": u"Conditions evaluating an event attribute, tag, or level are outdated please use an appropriate filter instead."
                    }
                )

        return attrs

    def save(self, rule):
        rule.project = self.context["project"]
        if "environment" in self.validated_data:
            environment = self.validated_data["environment"]
            rule.environment_id = int(environment) if environment else environment
        if self.validated_data.get("name"):
            rule.label = self.validated_data["name"]
        if self.validated_data.get("actionMatch"):
            rule.data["action_match"] = self.validated_data["actionMatch"]
        if self.validated_data.get("filterMatch"):
            rule.data["filter_match"] = self.validated_data["filterMatch"]
        if self.validated_data.get("actions") is not None:
            rule.data["actions"] = self.validated_data["actions"]
        if self.validated_data.get("conditions") is not None:
            rule.data["conditions"] = self.validated_data["conditions"]
        if self.validated_data.get("frequency"):
            rule.data["frequency"] = self.validated_data["frequency"]
        rule.save()
        return rule
