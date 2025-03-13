from collections.abc import Mapping
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer
from sentry.incidents.endpoints.serializers.alert_rule_trigger_action import (
    get_identifier_from_action,
    get_input_channel_id,
    human_desc,
)
from sentry.notifications.models.notificationaction import ActionService, ActionTarget
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.workflow_engine.handlers.action.notification.handler import MetricAlertRegistryInvoker
from sentry.workflow_engine.models import Action, DataConditionGroup, DataConditionGroupAction


class WorkflowEngineActionSerializer(Serializer):
    def serialize(
        self, obj: Action, attrs: Mapping[str, Any], user: User | RpcUser | AnonymousUser, **kwargs
    ) -> dict[str, Any]:
        """
        Temporary serializer to take an Action and serialize it for the old metric alert rule endpoints
        """
        from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING

        data_condition_group_action = DataConditionGroupAction.objects.get(action_id=obj.id)
        data_condition_group = DataConditionGroup.objects.get(
            id=data_condition_group_action.condition_group.id
        )

        priority = obj.data.get("priority")
        type_value = ActionService.get_value(obj.type)
        target = MetricAlertRegistryInvoker.target(obj)

        target_type = obj.config.get("target_type")
        target_identifier = obj.config.get("target_identifier")
        target_display = obj.config.get("target_display")

        sentry_app_id = obj.data.get("sentry_app_id")
        sentry_app_config = obj.data.get("sentry_app_config")

        result = {
            "id": str(obj.id),
            "alertRuleTriggerId": str(
                data_condition_group.id
            ),  # CEO: it feels wrong to set this, will it mess up customer's workflows?
            "type": obj.type,
            "targetType": ACTION_TARGET_TYPE_TO_STRING[ActionTarget(target_type)],
            "targetIdentifier": get_identifier_from_action(
                type_value, str(target_identifier), target_display
            ),
            "inputChannelId": get_input_channel_id(type_value, target_identifier),
            "integrationId": obj.integration_id,
            "sentryAppId": sentry_app_id,
            "dateCreated": obj.date_added,
            "desc": human_desc(
                type_value,
                target_type,
                target_identifier,
                target,
                target_display,
                target_identifier,
                priority,
            ),
            "priority": priority,
        }

        # Check if action is a Sentry App that has Alert Rule UI Component settings
        if sentry_app_id and sentry_app_config:
            result["settings"] = sentry_app_config

        return result
