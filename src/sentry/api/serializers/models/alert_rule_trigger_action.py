from __future__ import absolute_import

import six

from sentry.api.serializers import register, Serializer
from sentry.incidents.models import AlertRuleTriggerAction


@register(AlertRuleTriggerAction)
class AlertRuleTriggerActionSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        from sentry.incidents.endpoints.serializers import action_target_type_to_string

        return {
            "id": six.text_type(obj.id),
            "alertRuleTriggerId": six.text_type(obj.alert_rule_trigger_id),
            "type": AlertRuleTriggerAction.get_registered_type(
                AlertRuleTriggerAction.Type(obj.type)
            ).slug,
            "targetType": action_target_type_to_string[
                AlertRuleTriggerAction.TargetType(obj.target_type)
            ],
            "targetIdentifier": obj.target_display
            if obj.target_display is not None
            else obj.target_identifier,
            "integrationId": obj.integration_id,
            "dateCreated": obj.date_added,
        }
