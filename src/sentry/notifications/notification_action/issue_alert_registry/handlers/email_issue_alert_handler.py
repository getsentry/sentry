from typing import Any

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import (
    ActionFieldMapping,
    ActionFieldMappingKeys,
    EmailActionHelper,
    EmailDataBlob,
    EmailFieldMappingKeys,
)


@issue_alert_handler_registry.register(Action.Type.EMAIL)
class EmailIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_integration_id(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}

    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}

    @classmethod
    def get_target_identifier(
        cls, action: Action, mapping: ActionFieldMapping, organization_id: int
    ) -> dict[str, Any]:
        target_id = action.config.get("target_identifier")
        target_type = action.config.get("target_type")

        # this would be when the target_type is IssueOwners
        if target_id is None:
            if target_type != ActionTarget.ISSUE_OWNERS.value:
                raise ValueError(
                    f"No target identifier found for {action.type} action {action.id}, target_type: {target_type}"
                )
            return {}
        else:
            return {mapping[ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value]: target_id}

    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        target_type = ActionTarget(action.config.get("target_type"))

        final_blob = {
            EmailFieldMappingKeys.TARGET_TYPE_KEY.value: EmailActionHelper.get_target_type_string(
                target_type
            ),
        }

        if target_type == ActionTarget.ISSUE_OWNERS.value:
            blob = EmailDataBlob(**action.data)
            final_blob[EmailFieldMappingKeys.FALLTHROUGH_TYPE_KEY.value] = blob.fallthrough_type

        return final_blob
