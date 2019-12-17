from __future__ import absolute_import

from collections import defaultdict

import six

from sentry.api.serializers import register, Serializer
from sentry.incidents.models import AlertRuleTrigger, AlertRuleTriggerExclusion


@register(AlertRuleTrigger)
class AlertRuleTriggerSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "alertRuleId": six.text_type(obj.alert_rule_id),
            "label": obj.label,
            "thresholdType": obj.threshold_type,
            "alertThreshold": obj.alert_threshold,
            "resolveThreshold": obj.resolve_threshold,
            "dateCreated": obj.date_added,
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
