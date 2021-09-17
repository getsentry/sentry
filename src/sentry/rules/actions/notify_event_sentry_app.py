"""
Used for notifying a *specific* sentry app with a custom webhook payload (i.e. specified UI components)
"""
from sentry.api.serializers import serialize
from sentry.api.serializers.models.sentry_app_component import SentryAppAlertRuleActionSerializer
from sentry.coreapi import APIError
from sentry.mediators import sentry_app_components
from sentry.models import SentryAppComponent, SentryAppInstallation
from sentry.rules.actions.base import EventAction


class NotifyEventSentryAppAction(EventAction):
    actionType = "sentryapp"
    # Required field for EventAction, value is ignored
    label = ""

    def get_custom_actions(self, project):
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
                    # These details are unique to the Sentry App
                    action_details = serialize(
                        component, None, SentryAppAlertRuleActionSerializer(), install=install
                    )
                    # These details are shared among each Sentry App action (with UI)
                    action_details["id"] = self.id
                    action_details["enabled"] = self.is_enabled()
                    action_details["actionType"] = self.actionType
                    action_list.append(action_details)
                except APIError:
                    continue
        return action_list
