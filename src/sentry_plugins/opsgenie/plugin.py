import logging

from django import forms

import sentry
from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.plugins.bases import notify
from sentry.utils import json
from sentry_plugins.base import CorePluginMixin

from .client import OpsGenieApiClient

DESCRIPTION = """
Trigger alerts in Opsgenie from Sentry.

Opsgenie is a cloud-based service for dev & ops teams, providing reliable
alerts, on-call schedule management and escalations. OpsGenie integrates with
monitoring tools & services, ensures the right people are notified.
"""


class OpsGenieOptionsForm(notify.NotificationConfigurationForm):
    api_key = forms.CharField(
        max_length=255,
        help_text="OpsGenie API key used for authenticating API requests",
        required=True,
    )
    recipients = forms.CharField(
        max_length=255,
        help_text="The user names of individual users or groups (comma separated)",
        required=False,
    )
    alert_url = forms.CharField(
        max_length=255,
        label="OpsGenie Alert URL",
        widget=forms.TextInput(
            attrs={"class": "span6", "placeholder": "e.g. https://api.opsgenie.com/v2/alerts"}
        ),
        help_text="It must be visible to the Sentry server",
        required=True,
    )


class OpsGeniePlugin(CorePluginMixin, notify.NotificationPlugin):
    author = "Sentry Team"
    author_url = "https://github.com/getsentry"
    title = "OpsGenie"
    slug = "opsgenie"
    description = DESCRIPTION
    conf_key = "opsgenie"
    version = sentry.VERSION
    project_conf_form = OpsGenieOptionsForm
    required_field = "api_key"
    feature_descriptions = [
        FeatureDescription(
            """
            Manage incidents and outages by sending Sentry notifications to OpsGenie.
            """,
            IntegrationFeatures.INCIDENT_MANAGEMENT,
        ),
        FeatureDescription(
            """
            Configure Sentry rules to trigger notifications based on conditions you set.
            """,
            IntegrationFeatures.ALERT_RULE,
        ),
    ]

    logger = logging.getLogger("sentry.plugins.opsgenie")

    def is_configured(self, project):
        return all(self.get_option(k, project) for k in ("api_key", "alert_url"))

    def get_form_initial(self, project=None):
        return {"alert_url": "https://api.opsgenie.com/v2/alerts"}

    def build_payload(self, group, event, triggering_rules):
        payload = {
            "message": event.message or event.title,
            "alias": "sentry: %d" % group.id,
            "source": "Sentry",
            "details": {
                "Sentry ID": str(group.id),
                "Sentry Group": getattr(group, "title", group.message).encode("utf-8"),
                "Project ID": group.project.slug,
                "Project Name": group.project.name,
                "Logger": group.logger,
                "Level": group.get_level_display(),
                "URL": group.get_absolute_url(),
                "Triggering Rules": json.dumps(triggering_rules),
            },
            "entity": group.culprit,
        }

        payload["tags"] = [
            "{}:{}".format(str(x).replace(",", ""), str(y).replace(",", "")) for x, y in event.tags
        ]

        return payload

    def notify_users(self, group, event, fail_silently=False, triggering_rules=None, **kwargs):
        if not self.is_configured(group.project):
            return

        client = self.get_client(group.project)
        payload = self.build_payload(group, event, triggering_rules)
        try:
            client.trigger_incident(payload)
        except Exception as e:
            self.raise_error(e)

    def get_client(self, project):
        api_key = self.get_option("api_key", project)
        alert_url = self.get_option("alert_url", project)
        recipients = self.get_option("recipients", project)
        return OpsGenieApiClient(api_key, alert_url, recipients)
