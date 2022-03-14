"""
Used for notifying a *specific* plugin/sentry app with a generic webhook payload
"""
import logging

from django import forms

from sentry import analytics
from sentry.api.serializers import serialize
from sentry.api.serializers.models.app_platform_event import AppPlatformEvent
from sentry.api.serializers.models.incident import IncidentSerializer
from sentry.constants import SentryAppInstallationStatus
from sentry.incidents.models import INCIDENT_STATUS, IncidentStatus
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models import SentryApp, SentryAppInstallation
from sentry.plugins.base import plugins
from sentry.rules.actions.base import EventAction
from sentry.rules.actions.services import PluginService, SentryAppService
from sentry.tasks.sentry_apps import notify_sentry_app, send_and_save_webhook_request
from sentry.utils import metrics
from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.integrations.sentry_app")
PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS = ["PagerDuty", "Slack"]


def build_incident_attachment(incident, new_status: IncidentStatus, metric_value=None):
    from sentry.api.serializers.rest_framework.base import (
        camel_to_snake_case,
        convert_dict_key_case,
    )

    data = incident_attachment_info(incident, new_status, metric_value)
    return {
        "metric_alert": convert_dict_key_case(
            serialize(incident, serializer=IncidentSerializer()), camel_to_snake_case
        ),
        "description_text": data["text"],
        "description_title": data["title"],
        "web_url": data["title_link"],
    }


def send_incident_alert_notification(
    action, incident, new_status: IncidentStatus, metric_value=None
):
    """
    When a metric alert is triggered, send incident data to the SentryApp's webhook.
    :param action: The triggered `AlertRuleTriggerAction`.
    :param incident: The `Incident` for which to build a payload.
    :param metric_value: The value of the metric that triggered this alert to
    fire. If not provided we'll attempt to calculate this ourselves.
    :return:
    """
    sentry_app = action.sentry_app
    organization = incident.organization
    metrics.incr("notifications.sent", instance=sentry_app.slug, skip_internal=False)

    try:
        install = SentryAppInstallation.objects.get(
            organization=organization.id,
            sentry_app=sentry_app,
            status=SentryAppInstallationStatus.INSTALLED,
        )
    except SentryAppInstallation.DoesNotExist:
        logger.info(
            "metric_alert_webhook.missing_installation",
            extra={
                "action": action.id,
                "incident": incident.id,
                "organization": organization.slug,
                "sentry_app_id": sentry_app.id,
            },
        )
        return

    app_platform_event = AppPlatformEvent(
        resource="metric_alert",
        action=INCIDENT_STATUS[new_status].lower(),
        install=install,
        data=build_incident_attachment(incident, new_status, metric_value),
    )

    # Can raise errors if client returns >= 400
    send_and_save_webhook_request(
        sentry_app,
        app_platform_event,
    )

    # On success, record analytic event for Metric Alert Rule UI Component
    alert_rule_action_ui_component = find_alert_rule_action_ui_component(app_platform_event)

    if alert_rule_action_ui_component:
        analytics.record(
            "alert_rule_ui_component_webhook.sent",
            organization_id=organization.id,
            sentry_app_id=sentry_app.id,
            event=f"{app_platform_event.resource}.{app_platform_event.action}",
        )


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

    def __init__(self, *args, **kwargs):
        service_choices = [(s.slug, s.title) for s in kwargs.pop("services")]

        super().__init__(*args, **kwargs)

        self.fields["service"].choices = service_choices
        self.fields["service"].widget.choices = self.fields["service"].choices


class NotifyEventServiceAction(EventAction):
    form_cls = NotifyEventServiceForm
    label = "Send a notification via {service}"
    prompt = "Send a notification via an integration"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "service": {
                "type": "choice",
                "choices": [[i.slug, self.transform_title(i.title)] for i in self.get_services()],
            }
        }

    def transform_title(self, title):
        if title in PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS:
            return f"(Legacy) {title}"
        return title

    def after(self, event, state):
        service = self.get_option("service")

        extra = {"event_id": event.event_id}
        if not service:
            self.logger.info("rules.fail.is_configured", extra=extra)
            return

        plugin = None
        app = None
        try:
            app = SentryApp.objects.get(slug=service)
        except SentryApp.DoesNotExist:
            pass

        if app:
            kwargs = {"sentry_app": app}
            metrics.incr("notifications.sent", instance=app.slug, skip_internal=False)
            yield self.future(notify_sentry_app, **kwargs)

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

    def get_sentry_app_services(self):
        # excludes Sentry Apps that have Alert Rule UI Component in their schema
        return [
            SentryAppService(app)
            for app in SentryApp.objects.get_alertable_sentry_apps(self.project.organization_id)
            if not SentryAppService(app).has_alert_rule_action()
        ]

    def get_plugins(self):
        from sentry.plugins.bases.notify import NotificationPlugin

        results = []
        for plugin in plugins.for_project(self.project, version=1):
            if not isinstance(plugin, NotificationPlugin):
                continue
            results.append(PluginService(plugin))

        for plugin in plugins.for_project(self.project, version=2):
            for notifier in safe_execute(plugin.get_notifiers, _with_transaction=False) or ():
                results.append(PluginService(notifier))

        return results

    def get_services(self):
        services = self.get_plugins()
        services += self.get_sentry_app_services()
        return services

    def get_form_instance(self):
        return self.form_cls(self.data, services=self.get_services())
