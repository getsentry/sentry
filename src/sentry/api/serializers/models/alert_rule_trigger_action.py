from __future__ import absolute_import

import six

from sentry.api.serializers import register, Serializer
from sentry.incidents.models import AlertRuleTriggerAction


@register(AlertRuleTriggerAction)
class AlertRuleTriggerActionSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "alertRuleTriggerId": six.text_type(obj.alert_rule_trigger_id),
            "type": obj.type,
            "targetType": obj.target_type,
            "targetIdentifier": obj.target_identifier,
            "targetDisplay": obj.target_display
            if obj.target_display is not None
            else obj.target_identifier,
            "integrationId": obj.integration_id,
            "dateAdded": obj.date_added,
        }
