"""
Used for notifying a *specific* sentry app with a custom webhook payload (i.e. specified UI components)
"""
from typing import Any, Mapping, Optional, Sequence

from sentry.api.serializers import serialize
from sentry.api.serializers.models.sentry_app_component import SentryAppAlertRuleActionSerializer
from sentry.coreapi import APIError
from sentry.eventstore.models import Event
from sentry.mediators import sentry_app_components
from sentry.models import Project, SentryApp, SentryAppComponent, SentryAppInstallation
from sentry.rules.actions.base import EventAction
from sentry.tasks.sentry_apps import notify_sentry_app


class NotifyEventSentryAppAction(EventAction):  # type: ignore
    actionType = "sentryapp"
    # Required field for EventAction, value is ignored
    label = ""

    # TODO(Leander): As there is no form_cls (e.g. NotifyEventSentryAppActionForm) the form data will
    # not be validated on the backend. This is tricky to do since the schema form is dynamic, and will
    # be implemented on it's own in the future. Frontend validation is still in place in the mean time.

    # src/sentry/rules/actions/notify_event_sentry_app.py:25: error: Function is missing a type annotation

    def get_custom_actions(self, project: Project) -> Sequence[Mapping[str, Any]]:
        action_list = []
        for install in SentryAppInstallation.get_installed_for_org(project.organization_id):
            _components = SentryAppComponent.objects.filter(
                sentry_app_id=install.sentry_app_id, type="alert-rule-action"
            )
            for component in _components:
                try:
                    sentry_app_components.Preparer.run(
                        component=component, install=install, project=project
                    )
                    kwargs = {
                        "install": install,
                        "event_action": self,
                    }
                    action_details = serialize(
                        component, None, SentryAppAlertRuleActionSerializer(), **kwargs
                    )
                    action_list.append(action_details)
                except APIError:
                    continue
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

    def after(self, event: Event, state: str) -> Any:
        sentry_app = self.get_sentry_app(event)
        yield self.future(notify_sentry_app, sentry_app=sentry_app)
