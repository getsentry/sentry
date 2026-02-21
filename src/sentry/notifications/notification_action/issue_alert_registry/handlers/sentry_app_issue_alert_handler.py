from dataclasses import asdict
from typing import Any

from django.core.exceptions import ValidationError

from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app import app_service
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import (
    ActionFieldMapping,
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
    def _get_sentry_app_installation(cls, sentry_app_id, organization_id) -> SentryAppInstallation:
        sentry_app_installations = app_service.get_many(
            filter=dict(app_ids=[int(sentry_app_id)], organization_id=organization_id)
        )

        if sentry_app_installations is None or len(sentry_app_installations) != 1:
            raise ValueError(
                f"Expected 1 sentry app installation for sentry_app_id: {sentry_app_id}, but got {len(sentry_app_installations)}"
            )

        sentry_app_installation = sentry_app_installations[0]

        if sentry_app_installation is None:
            raise ValueError(f"Sentry app not found for sentry_app_id: {sentry_app_id}")
        return sentry_app_installation

    @classmethod
    def get_target_identifier(
        cls, action: Action, mapping: ActionFieldMapping, organization_id: int
    ) -> dict[str, Any]:
        target_identifier = action.config.get("target_identifier")
        if target_identifier is None:
            raise ValueError(f"No target identifier found for action type: {action.type}")

        return {"target_identifier": target_identifier}

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

    @classmethod
    def render_label(cls, organization_id: int, blob: dict[str, Any]) -> str:
        sentry_app_installation = cls._get_sentry_app_installation(
            blob["target_identifier"], organization_id
        )
        sentry_app = sentry_app_installation.sentry_app

        components = app_service.find_app_components(app_id=sentry_app.id)
        alert_rule_component = None

        for component in components:
            if component.type == "alert-rule-action":
                alert_rule_component = component

        if not alert_rule_component:
            raise ValidationError(
                f"Alert actions are not enabled for the {sentry_app.name} integration."
            )

        return str(alert_rule_component.app_schema.get("title"))
