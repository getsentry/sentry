from typing import Any

from rest_framework import serializers

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.rule import _generate_rule_label, _is_filter
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.rule import RuleNodeField, validate_actions
from sentry.blueprint.models import AlertProcedure, AlertTemplate
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.models.user import User


@register(AlertTemplate)
class AlertTemplateSerializer(Serializer):
    def serialize(self, obj: AlertTemplate, attrs: Any, user: User, **kwargs):
        all_conditions = [
            dict(list(o.items()) + [("name", _generate_rule_label(obj.project, obj, o))])
            for o in obj.issue_alert_data.get("conditions", [])
        ]
        issue_alert_data = {
            # conditions pertain to criteria that can trigger an alert
            "conditions": list(filter(lambda condition: not _is_filter(condition), all_conditions)),
            # filters are not new conditions but are the subset of conditions that pertain to event attributes
            "filters": list(filter(lambda condition: _is_filter(condition), all_conditions)),
            "actionMatch": obj.issue_alert_data.get("action_match") or Rule.DEFAULT_CONDITION_MATCH,
            "filterMatch": obj.issue_alert_data.get("filter_match") or Rule.DEFAULT_FILTER_MATCH,
            "frequency": obj.issue_alert_data.get("frequency") or Rule.DEFAULT_FREQUENCY,
        }

        return {
            "id": str(obj.id),
            "name": obj.name,
            "organization_id": obj.organization_id,
            # TODO(Leander): Use get_attrs
            "issue_alert_ids": [ia.id for ia in obj.issue_alerts],
            "issue_alert_data": issue_alert_data,
            "procedure": serialize(obj.procedure),
        }


@register(AlertProcedure)
class AlertProcedureSerializer(Serializer):
    def serialize(self, obj: AlertProcedure, attrs: Any, user: User, **kwargs):
        # TODO(Leander): Use get_attrs
        templates = AlertTemplate.objects.filter(procedure_id=obj.id)

        # XXX: Hack to avoid unravelling the project dependency :(
        project = Project.objects.filter(organization=obj.organization).first()
        actions = []
        for action in obj.issue_alert_actions:
            try:
                actions.append(
                    dict(
                        list(action.items())
                        + [("name", _generate_rule_label(project, obj, action))]
                    )
                )
            except serializers.ValidationError:
                # Integrations can be deleted and we don't want to fail to load the rule
                pass

        return {
            "id": str(obj.id),
            # TODO(Leander): Use a better serializer or expand
            "templates": [{"id": t.id, "name": t.name} for t in templates],
            "label": obj.label,
            "organization_id": obj.organization_id,
            "is_manual": obj.is_manual,
            "issue_alert_actions": actions,
        }


class IncomingAlertProcedureSerializer(CamelSnakeModelSerializer):
    label = serializers.CharField(max_length=255)
    is_manual = serializers.BooleanField(default=False)
    issue_alert_actions = serializers.ListField(
        child=RuleNodeField(type="action/event"), required=False
    )

    class Meta:
        model = AlertProcedure
        fields = ["label", "is_manual", "issue_alert_actions"]

    def validate_label(self, incoming_label: str):
        existing_id = self.context.get("procedure_id")
        procedure_qs = AlertProcedure.objects.filter(
            organization_id=self.context["organization"].id, label=incoming_label
        )
        if existing_id:
            procedure_qs = procedure_qs.exclude(id=existing_id)
        if procedure_qs.exists():
            raise serializers.ValidationError(
                detail="Choose a better label nerd, that one's taken."
            )
        return incoming_label

    def validate(self, attrs):
        return validate_actions(attrs)

    def create(self, validated_data):
        return AlertProcedure.objects.create(
            organization_id=self.context["organization"].id,
            **validated_data,
        )
