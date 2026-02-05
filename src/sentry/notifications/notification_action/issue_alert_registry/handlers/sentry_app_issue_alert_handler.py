from dataclasses import asdict
from typing import Any

from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler
from sentry.sentry_apps.services.app import app_service
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import (
    ActionFieldMapping,
    ActionFieldMappingKeys,
    SentryAppDataBlob,
    SentryAppFormConfigDataBlob,
)


@issue_alert_handler_registry.register(Action.Type.SENTRY_APP)
class SentryAppIssueAlertHandler(BaseIssueAlertHandler):
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
        if mapping.get(ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value):
            target_identifier = action.config.get("target_identifier")
            if target_identifier is None:
                raise ValueError(f"No target identifier found for action type: {action.type}")

            sentry_app_installations = app_service.get_many(
                filter=dict(app_ids=[target_identifier], organization_id=organization_id)
            )

            if sentry_app_installations is None or len(sentry_app_installations) != 1:
                raise ValueError(
                    f"Expected 1 sentry app installation for action type: {action.type}, target_identifier: {target_identifier}, but got {len(sentry_app_installations)}"
                )

            sentry_app_installation = sentry_app_installations[0]

            if sentry_app_installation is None:
                raise ValueError(
                    f"Sentry app not found for action type: {action.type}, target_identifier: {target_identifier}"
                )

            return {
                mapping[
                    ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
                ]: sentry_app_installation.uuid
            }
        raise ValueError(f"No target identifier key found for action type: {action.type}")

    @classmethod
    def process_settings(cls, settings: list[SentryAppFormConfigDataBlob]) -> list[dict[str, Any]]:
        # Process each setting, removing None labels
        return [
            {k: v for k, v in asdict(setting).items() if not (k == "label" and v is None)}
            for setting in settings
        ]

    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        # Need to check for the settings key, if it exists, then we need to return the settings
        # It won't exist for legacy webhook actions, but will exist for sentry app actions
        if settings_list := action.data.get("settings"):
            if not isinstance(settings_list, list):
                raise ValueError(f"Settings must be a list for action type: {action.type}")
            blob = SentryAppDataBlob.from_list(settings_list)
            settings = cls.process_settings(blob.settings)
            return {"settings": settings}
        return {}
