from __future__ import absolute_import

import logging
import six
import sentry

from django import forms
from django.conf import settings
from django.utils.translation import ugettext_lazy as _

from sentry.exceptions import PluginError
from sentry.plugins.bases import notify
from sentry.http import is_valid_url, safe_urlopen
from sentry.utils.safe import safe_execute
from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.utils.compat import filter

DESCRIPTION = """
Trigger outgoing HTTP POST requests from Sentry.

Note: To configure webhooks over multiple projects, we recommend setting up an
[Internal Integration](https://docs.sentry.io/workflow/integrations/integration-platform/#internal-integrations).
"""


def split_urls(value):
    if not value:
        return ()
    return filter(bool, (url.strip() for url in value.splitlines()))


def validate_urls(value, **kwargs):
    urls = split_urls(value)
    if any((not u.startswith(("http://", "https://")) or not is_valid_url(u)) for u in urls):
        raise PluginError("Not a valid URL.")
    return "\n".join(urls)


class WebHooksOptionsForm(notify.NotificationConfigurationForm):
    urls = forms.CharField(
        label=_("Callback URLs"),
        widget=forms.Textarea(
            attrs={"class": "span6", "placeholder": "https://sentry.io/callback/url"}
        ),
        help_text=_("Enter callback URLs to POST new events to (one per line)."),
    )


class WebHooksPlugin(notify.NotificationPlugin):
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    version = sentry.VERSION
    description = DESCRIPTION
    resource_links = [
        ("Report Issue", "https://github.com/getsentry/sentry/issues"),
        (
            "View Source",
            "https://github.com/getsentry/sentry/tree/master/src/sentry/plugins/sentry_webhooks",
        ),
    ]

    slug = "webhooks"
    title = "WebHooks"
    conf_title = title
    conf_key = "webhooks"
    # TODO(dcramer): remove when this is migrated to React
    project_conf_form = WebHooksOptionsForm
    timeout = getattr(settings, "SENTRY_WEBHOOK_TIMEOUT", 3)
    logger = logging.getLogger("sentry.plugins.webhooks")
    user_agent = "sentry-webhooks/%s" % version
    required_field = "urls"
    feature_descriptions = [
        FeatureDescription(
            """
            Configure rule based outgoing HTTP POST requests from Sentry.
            """,
            IntegrationFeatures.ALERT_RULE,
        )
    ]

    def is_configured(self, project, **kwargs):
        return bool(self.get_option("urls", project))

    def get_config(self, project, **kwargs):
        return [
            {
                "name": "urls",
                "label": "Callback URLs",
                "type": "textarea",
                "help": "Enter callback URLs to POST new events to (one per line).",
                "placeholder": "https://sentry.io/callback/url",
                "validators": [validate_urls],
                "required": False,
            }
        ]

    def get_group_data(self, group, event, triggering_rules):
        data = {
            "id": six.text_type(group.id),
            "project": group.project.slug,
            "project_name": group.project.name,
            "project_slug": group.project.slug,
            "logger": event.get_tag("logger"),
            "level": event.get_tag("level"),
            "culprit": group.culprit,
            "message": event.message,
            "url": group.get_absolute_url(params={"referrer": "webhooks_plugin"}),
            "triggering_rules": triggering_rules,
        }
        data["event"] = dict(event.data or {})
        data["event"]["tags"] = event.tags
        data["event"]["event_id"] = event.event_id
        data["event"]["id"] = event.event_id
        return data

    def get_webhook_urls(self, project):
        return split_urls(self.get_option("urls", project))

    def send_webhook(self, url, payload):
        return safe_urlopen(url=url, json=payload, timeout=self.timeout, verify_ssl=False)

    def notify_users(self, group, event, triggering_rules, fail_silently=False, **kwargs):
        payload = self.get_group_data(group, event, triggering_rules)
        for url in self.get_webhook_urls(group.project):
            # TODO: Use API client with raise_error
            safe_execute(self.send_webhook, url, payload, _with_transaction=False)
