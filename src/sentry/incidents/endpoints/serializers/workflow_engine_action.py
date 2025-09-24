from collections.abc import Mapping
from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.db.models import Subquery

from sentry.api.serializers import Serializer
from sentry.incidents.endpoints.serializers.alert_rule_trigger_action import (
    get_identifier_from_action,
    get_input_channel_id,
    human_desc,
)
from sentry.notifications.models.notificationaction import ActionService, ActionTarget
from sentry.notifications.notification_action.group_type_notification_registry.handlers.metric_alert_registry_handler import (
    MetricAlertRegistryHandler,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.workflow_engine.models import (
    Action,
    ActionAlertRuleTriggerAction,
    DataCondition,
    DataConditionAlertRuleTrigger,
    DataConditionGroupAction,
    DetectorWorkflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition


class WorkflowEngineActionSerializer(Serializer):
    def get_alert_rule_trigger_id(self, action: Action) -> int | None:
        """
        Fetches the alert rule trigger id for the detector trigger related to the given action
        """
        action_filter_data_condition = DataCondition.objects.filter(
            condition_group__in=Subquery(
                DataConditionGroupAction.objects.filter(action=action).values("condition_group")
            ),
            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
            condition_result=True,
        )
        detector_dcg = DetectorWorkflow.objects.filter(
            workflow__in=Subquery(
                WorkflowDataConditionGroup.objects.filter(
                    condition_group__in=Subquery(
                        action_filter_data_condition.values("condition_group")
                    )
                ).values("workflow")
            )
        ).values("detector__workflow_condition_group")
        detector_trigger = DataCondition.objects.filter(
            condition_result__in=Subquery(action_filter_data_condition.values("comparison")),
            condition_group__in=detector_dcg,
        )
        return DataConditionAlertRuleTrigger.objects.values_list(
            "alert_rule_trigger_id", flat=True
        ).get(data_condition__in=detector_trigger)

    def serialize(
        self, obj: Action, attrs: Mapping[str, Any], user: User | RpcUser | AnonymousUser, **kwargs
    ) -> dict[str, Any]:
        """
        Temporary serializer to take an Action and serialize it for the old metric alert rule endpoints
        """
        from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING

        aarta = ActionAlertRuleTriggerAction.objects.get(action=obj.id)
        priority = obj.data.get("priority")
        type_value = ActionService.get_value(obj.type)
        target = MetricAlertRegistryHandler.target(obj)

        target_type = obj.config["target_type"]
        target_identifier = obj.config.get("target_identifier")
        target_display = obj.config.get("target_display")

        sentry_app_id = None
        sentry_app_config = None
        if obj.type == Action.Type.SENTRY_APP.value:
            sentry_app_id = int(obj.config["target_identifier"])
            sentry_app_config = obj.data.get("settings")

        result = {
            "id": str(aarta.alert_rule_trigger_action_id),
            "alertRuleTriggerId": str(self.get_alert_rule_trigger_id(aarta.action)),
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
