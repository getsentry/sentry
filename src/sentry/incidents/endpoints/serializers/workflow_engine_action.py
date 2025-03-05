from sentry.api.serializers import Serializer
from sentry.incidents.endpoints.serializers.alert_rule_trigger_action import (
    get_identifier_from_action,
    get_input_channel_id,
    human_desc,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.notifications.models.notificationaction import ActionService
from sentry.workflow_engine.handlers.action.notification.handler import MetricAlertRegistryInvoker
from sentry.workflow_engine.models import ActionAlertRuleTriggerAction


class WorkflowEngineActionSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        """
        Temporary serializer to take an Action and serialize it for the old metric alert rule endpoints
        """
        from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING

        aarta = ActionAlertRuleTriggerAction.objects.get(action=obj.id)
        priority = obj.data.get("priority")
        type_value = ActionService.get_value(obj.type)
        target = MetricAlertRegistryInvoker.target(obj)
        result = {
            "id": str(aarta.alert_rule_trigger_action.id),
            "alertRuleTriggerId": str(aarta.alert_rule_trigger_action.alert_rule_trigger.id),
            "type": obj.type,
            "targetType": ACTION_TARGET_TYPE_TO_STRING[
                AlertRuleTriggerAction.TargetType(obj.target_type)
            ],
            "targetIdentifier": get_identifier_from_action(
                type_value, str(obj.target_identifier), obj.target_display
            ),
            "inputChannelId": get_input_channel_id(type_value, obj.target_identifier),
            "integrationId": obj.integration_id,
            "sentryAppId": obj.data.get("sentry_app_id"),
            "dateCreated": obj.date_added,
            "desc": human_desc(
                type_value,
                obj.target_type,
                obj.target_identifier,
                target,
                obj.target_display,
                obj.target_identifier,
                priority,
            ),
            "priority": priority,
        }

        # Check if action is a Sentry App that has Alert Rule UI Component settings
        if obj.data.get("sentry_app_id") and obj.data.get("sentry_app_config"):
            result["settings"] = obj.data.get("sentry_app_config")

        return result
