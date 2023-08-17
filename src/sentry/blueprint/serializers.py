from rest_framework import serializers

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.rule import _generate_rule_label, _is_filter
from sentry.blueprint.models import AlertProcedure, AlertTemplate
from sentry.models.rule import Rule


@register(AlertTemplate)
class AlertTemplateSerializer(Serializer):
    def serialize(self, obj: AlertTemplate, attrs, **kwargs):
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
    def serialize(self, obj: AlertProcedure, attrs, **kwargs):
        # TODO(Leander): Use get_attrs
        templates = AlertTemplate.objects.filter(procedure_id=obj.id)
        actions = []
        for action in obj.issue_alert_actions:
            try:
                actions.append(
                    dict(
                        list(action.items())
                        + [("name", _generate_rule_label(obj.project, obj, action))]
                    )
                )
            except serializers.ValidationError:
                # Integrations can be deleted and we don't want to fail to load the rule
                pass

        return {
            "id": str(obj.id),
            # TODO(Leander): Use a better serializer or expand
            "templates": [{"id": t.id, "name": t.name} for t in templates],
            "label": obj.name,
            "organization_id": obj.organization_id,
            "is_manual": obj.is_manual,
            "issue_alert_actions": actions,
        }
