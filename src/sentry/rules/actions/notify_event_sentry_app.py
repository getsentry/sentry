"""
Used for notifying a *specific* sentry app with a custom webhook payload (i.e. specified UI components)
"""
from typing import Any, Mapping, Optional, Sequence

from rest_framework import serializers

from sentry.api.serializers import serialize
from sentry.api.serializers.models.sentry_app_component import SentryAppAlertRuleActionSerializer
from sentry.eventstore.models import Event
from sentry.models import Project, SentryApp, SentryAppInstallation
from sentry.models.sentryappcomponent import SentryAppComponent
from sentry.rules.actions.base import EventAction
from sentry.tasks.sentry_apps import notify_sentry_app

ValidationError = serializers.ValidationError


def validate_field(value: str, field: Mapping[str, Any], app_name: str):
    # Only validate synchronous select fields
    if field.get("type") == "select" and not field.get("uri"):
        allowed_values = [option[0] for option in field.get("options")]
        if value not in allowed_values:
            field_label = field.get("label")
            allowed_values_message = ", ".join(allowed_values)
            raise ValidationError(
                f"{app_name} received {value} for {field_label} setting. Allowed values are {allowed_values_message}'"
            )


class NotifyEventSentryAppAction(EventAction):  # type: ignore
    actionType = "sentryapp"
    # Required field for EventAction, value is ignored
    label = ""

    # TODO(Leander): As there is no form_cls (e.g. NotifyEventSentryAppActionForm) the form data will
    # not be validated on the backend. This is tricky to do since the schema form is dynamic, and will
    # be implemented on it's own in the future. Frontend validation is still in place in the mean time.

    def get_custom_actions(self, project: Project) -> Sequence[Mapping[str, Any]]:
        action_list = []
        for install in SentryAppInstallation.get_installed_for_org(project.organization_id):
            component = install.prepare_sentry_app_components("alert-rule-action", project)
            if component:
                kwargs = {
                    "install": install,
                    "event_action": self,
                }
                action_details = serialize(
                    component, None, SentryAppAlertRuleActionSerializer(), **kwargs
                )
                action_list.append(action_details)

        return action_list

    def get_sentry_app(self, event: Event) -> Optional[SentryApp]:
        extra = {"event_id": event.event_id}

        sentry_app_installation_uuid = self.get_option("sentryAppInstallationUuid")
        if not sentry_app_installation_uuid:
            self.logger.info("rules.fail.is_configured", extra=extra)
            return None

        try:
            return SentryApp.objects.get(installations__uuid=sentry_app_installation_uuid)
        except SentryApp.DoesNotExist:
            self.logger.info("rules.fail.no_app", extra=extra)

        return None

    def self_validate(self, data):
        sentry_app_installation_uuid = data.get("sentryAppInstallationUuid")
        if not sentry_app_installation_uuid:
            raise ValidationError("Missing attribute 'sentryAppInstallationUuid'")

        try:
            sentry_app = SentryApp.objects.get(installations__uuid=sentry_app_installation_uuid)
        except SentryApp.DoesNotExist:
            raise ValidationError("Could not identify sentry app from the installation uuid.")

        try:
            alert_rule_component = SentryAppComponent.objects.get(
                sentry_app_id=sentry_app.id, type="alert-rule-action"
            )
        except SentryAppComponent.DoesNotExist:
            raise ValidationError(
                f"Alert Rule Actions are not enabled for the {sentry_app.name} integration."
            )

        incoming_settings = data.get("settings")
        if not incoming_settings:
            raise ValidationError(f"{sentry_app.name} requires settings to configure alert rules.")

        schema = alert_rule_component.schema.get("settings")
        all_fields = {}
        # Ensure required fields are provided and valid
        for required_field in schema.get("required_fields"):
            field_name = required_field.get("name")
            field_value = incoming_settings.get(field_name)
            if not field_value:
                raise ValidationError(
                    f"{sentry_app.name} is missing required settings field: '{field_name}'"
                )
            validate_field(field_value, required_field, sentry_app.name)
            all_fields[field_name] = field_value

        # Ensure optional fields are valid
        for optional_field in schema.get("optional_fields", []):
            field_name = optional_field.get("name")
            field_value = incoming_settings.get(field_name)
            validate_field(field_value, optional_field, sentry_app.name)
            all_fields[field_name] = field_value

        # Ensure the payload we send matches the expectations set in the schema
        for key in incoming_settings.keys():
            if key not in all_fields:
                raise ValidationError(
                    f"Unexpected setting '{key}' configured for {sentry_app.name}"
                )

        return data

    def after(self, event: Event, state: str) -> Any:
        sentry_app = self.get_sentry_app(event)
        yield self.future(
            notify_sentry_app,
            sentry_app=sentry_app,
            schema_defined_settings=self.get_option("settings"),
        )
