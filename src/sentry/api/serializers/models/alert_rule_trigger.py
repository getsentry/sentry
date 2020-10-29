from __future__ import absolute_import

from collections import defaultdict

import six

from sentry.api.serializers import register, serialize, Serializer
from sentry.incidents.models import (
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    AlertRuleTriggerExclusion,
)
from sentry.utils.compat import zip
from sentry.utils.db import attach_foreignkey


@register(AlertRuleTrigger)
class AlertRuleTriggerSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        attach_foreignkey(item_list, AlertRuleTrigger.alert_rule)

        triggers = {item.id: item for item in item_list}
        result = defaultdict(dict)

        actions = AlertRuleTriggerAction.objects.filter(alert_rule_trigger__in=item_list).order_by(
            "id"
        )
        serialized_actions = serialize(list(actions))
        for trigger, serialized in zip(actions, serialized_actions):
            triggers_actions = result[triggers[trigger.alert_rule_trigger_id]].setdefault(
                "actions", []
            )
            triggers_actions.append(serialized)

        return result

    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "alertRuleId": six.text_type(obj.alert_rule_id),
            "label": obj.label,
            "thresholdType": obj.alert_rule.threshold_type,
            "alertThreshold": obj.alert_threshold,
            "resolveThreshold": obj.alert_rule.resolve_threshold,
            "dateCreated": obj.date_added,
            "actions": attrs.get("actions", []),
        }


class DetailedAlertRuleTriggerSerializer(AlertRuleTriggerSerializer):
    def get_attrs(self, item_list, user, **kwargs):
        triggers = {item.id: item for item in item_list}
        result = defaultdict(dict)
        for trigger_id, project_slug in AlertRuleTriggerExclusion.objects.filter(
            alert_rule_trigger__in=item_list
        ).values_list("alert_rule_trigger_id", "query_subscription__project__slug"):
            exclusions = result[triggers[trigger_id]].setdefault("excludedProjects", [])
            exclusions.append(project_slug)
        return result

    def serialize(self, obj, attrs, user):
        data = super(DetailedAlertRuleTriggerSerializer, self).serialize(obj, attrs, user)
        data["excludedProjects"] = sorted(attrs.get("excludedProjects", []))
        return data
