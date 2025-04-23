from collections import defaultdict
from typing import DefaultDict

from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.incidents.endpoints.utils import translate_threshold
from sentry.incidents.models.alert_rule import AlertRuleTrigger, AlertRuleTriggerAction


@register(AlertRuleTrigger)
class AlertRuleTriggerSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        prefetch_related_objects(item_list, "alert_rule")

        triggers = {item.id: item for item in item_list}
        result: DefaultDict[str, dict[str, list[str]]] = defaultdict(dict)

        actions = AlertRuleTriggerAction.objects.filter(alert_rule_trigger__in=item_list).order_by(
            "id"
        )
        serialized_actions = serialize(list(actions), **kwargs)
        for trigger, serialized in zip(actions, serialized_actions):
            triggers_actions = result[triggers[trigger.alert_rule_trigger_id]].setdefault(
                "actions", []
            )
            triggers_actions.append(serialized)

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "alertRuleId": str(obj.alert_rule_id),
            "label": obj.label,
            "thresholdType": obj.alert_rule.threshold_type,
            "alertThreshold": translate_threshold(obj.alert_rule, obj.alert_threshold),
            "resolveThreshold": translate_threshold(
                obj.alert_rule, obj.alert_rule.resolve_threshold
            ),
            "dateCreated": obj.date_added,
            "actions": attrs.get("actions", []),
        }
