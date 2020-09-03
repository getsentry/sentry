"""
Used for notifying a *specific* plugin
"""
from __future__ import absolute_import

import logging
from django import forms

from sentry.api.serializers.models.app_platform_event import AppPlatformEvent
from sentry.constants import SentryAppInstallationStatus
from sentry.incidents.logic import get_alertable_sentry_apps
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models import SentryApp, SentryAppInstallation
from sentry.plugins.base import plugins
from sentry.rules.actions.base import EventAction
from sentry.rules.actions.services import PluginService, SentryAppService
from sentry.tasks.sentry_apps import notify_sentry_app, send_and_save_webhook_request
from sentry.utils import metrics
from sentry.utils.safe import safe_execute


logger = logging.getLogger("sentry.integrations.sentry_app")


def send_incident_alert_notification(action, incident, metric_value=None):
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
            "event_alert_webhook.missing_installation",
            extra={
                "sentry_app_id": sentry_app.id,
                "organization": organization.slug,
                "organization_id": incident.organization_id,
                "target_identifier": sentry_app.id,
            }
        )
        return

    send_and_save_webhook_request(
        sentry_app.webhook_url,
        sentry_app,
        AppPlatformEvent(
            resource="metric_alert",
            action="triggered",
            install=install,
            data=incident_attachment_info(incident, metric_value),
        )
    )


class NotifyEventServiceForm(forms.Form):
    service = forms.ChoiceField(choices=())

    def __init__(self, *args, **kwargs):
        service_choices = [(s.slug, s.title) for s in kwargs.pop("services")]

        super(NotifyEventServiceForm, self).__init__(*args, **kwargs)

        self.fields["service"].choices = service_choices
        self.fields["service"].widget.choices = self.fields["service"].choices


class NotifyEventServiceAction(EventAction):
    form_cls = NotifyEventServiceForm
    label = "Send a notification via {service}"
    prompt = "Send a notification via an integration"

    def __init__(self, *args, **kwargs):
        super(NotifyEventServiceAction, self).__init__(*args, **kwargs)
        self.form_fields = {
            "service": {
                "type": "choice",
                "choices": [[i.slug, i.title] for i in self.get_services()],
            }
        }

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
        return [
            SentryAppService(app) for app in get_alertable_sentry_apps(self.project.organization_id)
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
