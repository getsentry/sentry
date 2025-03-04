from __future__ import annotations

import logging
from collections.abc import Generator, Sequence
from typing import Any

from django import forms

from sentry.api.serializers import serialize
from sentry.eventstore.models import GroupEvent
from sentry.incidents.endpoints.serializers.incident import IncidentSerializer
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.metric_alerts import (
    GetIncidentAttachmentInfoParams,
    get_metric_count_from_incident,
    incident_attachment_info,
)
from sentry.integrations.services.integration import integration_service
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.plugins.base import plugins
from sentry.rules.actions.base import EventAction
from sentry.rules.actions.services import PluginService
from sentry.rules.base import CallbackFuture
from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.services.app import RpcSentryAppService, app_service
from sentry.sentry_apps.tasks.sentry_apps import notify_sentry_app
from sentry.utils import json, metrics
from sentry.utils.forms import set_field_choices

logger = logging.getLogger("sentry.integrations.sentry_app")
PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS = ["PagerDuty", "Slack", "Opsgenie"]


def build_incident_attachment(
    incident: Incident,
    new_status: IncidentStatus,
    metric_value: float | None = None,
    notification_uuid: str | None = None,
) -> dict[str, str]:
    from sentry.api.serializers.rest_framework.base import (
        camel_to_snake_case,
        convert_dict_key_case,
    )

    if metric_value is None:
        metric_value = get_metric_count_from_incident(incident)

    data = incident_attachment_info(
        GetIncidentAttachmentInfoParams(
            name=incident.alert_rule.name,
            open_period_identifier_id=incident.identifier,
            action_identifier_id=incident.alert_rule.id,
            organization=incident.organization,
            threshold_type=AlertRuleThresholdType(incident.alert_rule.threshold_type),
            detection_type=AlertRuleDetectionType(incident.alert_rule.detection_type),
            snuba_query=incident.alert_rule.snuba_query,
            comparison_delta=incident.alert_rule.comparison_delta,
            new_status=new_status,
            metric_value=metric_value,
            notification_uuid=notification_uuid,
            referrer="metric_alert_sentry_app",
        )
    )

    return {
        "metric_alert": convert_dict_key_case(
            serialize(incident, serializer=IncidentSerializer()), camel_to_snake_case
        ),
        "description_text": data["text"],
        "description_title": data["title"],
        "web_url": data["title_link"],
    }


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    new_status: IncidentStatus,
    metric_value: float,
    notification_uuid: str | None = None,
) -> bool:
    """
    When a metric alert is triggered, send incident data to the SentryApp's webhook.
    :param action: The triggered `AlertRuleTriggerAction`.
    :param incident: The `Incident` for which to build a payload.
    :param metric_value: The value of the metric that triggered this alert to
    fire.
    :return:
    """
    organization = serialize_rpc_organization(incident.organization)
    incident_attachment = build_incident_attachment(
        incident, new_status, metric_value, notification_uuid
    )

    success = integration_service.send_incident_alert_notification(
        sentry_app_id=action.sentry_app_id,
        action_id=action.id,
        incident_id=incident.id,
        organization_id=organization.id,
        new_status=new_status.value,
        incident_attachment_json=json.dumps(incident_attachment),
        metric_value=metric_value,
    )
    return success


def find_alert_rule_action_ui_component(app_platform_event: AppPlatformEvent) -> bool:
    """
    Loop through the triggers for the alert rule event. For each trigger, check
    if an action is an alert rule UI Component
    """
    triggers = (
        getattr(app_platform_event, "data", {})
        .get("metric_alert", {})
        .get("alert_rule", {})
        .get("triggers", [])
    )

    actions = [
        action
        for trigger in triggers
        for action in trigger.get("actions", {})
        if (action.get("type") == "sentry_app" and action.get("settings") is not None)
    ]

    return bool(len(actions))


class NotifyEventServiceForm(forms.Form):
    service = forms.ChoiceField(choices=())

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        service_choices = [(s.slug, s.title) for s in kwargs.pop("services")]

        super().__init__(*args, **kwargs)

        set_field_choices(self.fields["service"], service_choices)


class NotifyEventServiceAction(EventAction):
    """Used for notifying a *specific* plugin/sentry app with a generic webhook payload."""

    id = "sentry.rules.actions.notify_event_service.NotifyEventServiceAction"
    label = "Send a notification via {service}"
    prompt = "Send a notification via an integration"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "service": {
                "type": "choice",
                "choices": [[i.slug, self.transform_title(i.title)] for i in self.get_services()],
            }
        }

    def transform_title(self, title: str) -> str:
        if title in PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS:
            return f"(Legacy) {title}"
        return title

    def after(
        self, event: GroupEvent, notification_uuid: str | None = None
    ) -> Generator[CallbackFuture]:
        service = self.get_option("service")

        extra: dict[str, object] = {"event_id": event.event_id}
        if not service:
            self.logger.info("rules.fail.is_configured", extra=extra)
            return

        plugin = None
        app = app_service.get_sentry_app_by_slug(slug=service)

        if app:
            metrics.incr("notifications.sent", instance=app.slug, skip_internal=False)
            yield self.future(notify_sentry_app, sentry_app=app)

        try:
            plugin = plugins.get(service)
        except KeyError:
            if not app:
                # If we can't find the sentry app OR plugin,
                # we've removed the plugin no need to error, just skip.
                extra["plugin"] = service
                self.logger.info("rules.fail.plugin_does_not_exist", extra=extra)
                return

        if plugin:
            if not plugin.is_enabled(self.project):
                extra["project_id"] = self.project.id
                self.logger.info("rules.fail.is_enabled", extra=extra)
                return

            group = event.group

            if not plugin.should_notify(group=group, event=event):
                extra["group_id"] = group.id
                self.logger.info("rule.fail.should_notify", extra=extra)
                return

            metrics.incr("notifications.sent", instance=plugin.slug, skip_internal=False)
            yield self.future(plugin.rule_notify)

    def get_sentry_app_services(self) -> Sequence[RpcSentryAppService]:
        return app_service.find_alertable_services(organization_id=self.project.organization_id)

    def get_plugins(self) -> Sequence[PluginService]:
        from sentry.plugins.bases.notify import NotificationPlugin

        results = []
        for plugin in plugins.for_project(self.project, version=1):
            if not isinstance(plugin, NotificationPlugin):
                continue
            results.append(PluginService(plugin))

        return results

    def get_services(self) -> Sequence[Any]:
        return [*self.get_plugins(), *self.get_sentry_app_services()]

    def get_form_instance(self) -> NotifyEventServiceForm:
        return NotifyEventServiceForm(self.data, services=self.get_services())
