from __future__ import absolute_import

import six

from sentry.plugins.bases.notify import NotifyPlugin

from sentry_plugins.base import CorePluginMixin
from sentry_plugins.utils import get_secret_field_config
from sentry.integrations import FeatureDescription, IntegrationFeatures

from .client import PushoverClient

from sentry.exceptions import PluginError

DESCRIPTION = """
Get notified of Sentry alerts on any device using the Pushover integration.

Pushover makes it easy to get real-time notifications on your Android, iPhone, iPad, and Desktop.
"""


class PushoverPlugin(CorePluginMixin, NotifyPlugin):
    description = DESCRIPTION
    slug = "pushover"
    title = "Pushover"
    conf_title = "Pushover"
    conf_key = "pushover"
    required_field = "apikey"
    feature_descriptions = [
        FeatureDescription(
            """
            Have Pushover notifications get sent to your mobile device with the Pushover app.
            """,
            IntegrationFeatures.MOBILE,
        ),
        FeatureDescription(
            """
            Configure Sentry rules to trigger notifications based on conditions you set.
            """,
            IntegrationFeatures.ALERT_RULE,
        ),
    ]

    def is_configured(self, project):
        return all(self.get_option(key, project) for key in ("userkey", "apikey"))

    def get_config(self, **kwargs):
        userkey = self.get_option("userkey", kwargs["project"])
        apikey = self.get_option("apikey", kwargs["project"])

        userkey_field = get_secret_field_config(
            userkey, "Your user key. See https://pushover.net/", include_prefix=True
        )
        userkey_field.update({"name": "userkey", "label": "User Key"})

        apikey_field = get_secret_field_config(
            apikey, "Application API token. See https://pushover.net/apps/", include_prefix=True
        )

        apikey_field.update({"name": "apikey", "label": "API Key"})

        return [
            userkey_field,
            apikey_field,
            {
                "name": "priority",
                "label": "Message Priority",
                "type": "choice",
                "required": True,
                "choices": [
                    ("-2", "Lowest"),
                    ("-1", "Low"),
                    ("0", "Normal"),
                    ("1", "High"),
                    ("2", "Emergency"),
                ],
                "default": "0",
            },
            {
                "name": "retry",
                "label": "Retry",
                "type": "number",
                "required": False,
                "placeholder": "e.g. 30",
                "help": 'How often (in seconds) you will receive the same notification. Minimum of 30 seconds. Only required for "Emergency" level priority.',
            },
            {
                "name": "expire",
                "label": "Expire",
                "type": "number",
                "required": False,
                "placeholder": "e.g. 9000",
                "help": 'How many seconds your notification will continue to be retried for. Maximum of 10800 seconds. Only required for "Emergency" level priority.',
            },
        ]

    def validate_config(self, project, config, actor):
        if int(config["priority"]) == 2 and config["retry"] < 30:
            retry = six.text_type(config["retry"])
            self.logger.exception(six.text_type(u"Retry not 30 or higher. It is {}.".format(retry)))
            raise PluginError(u"Retry must be 30 or higher. It is {}.".format(retry))
        return config

    def get_client(self, project):
        return PushoverClient(
            apikey=self.get_option("apikey", project), userkey=self.get_option("userkey", project)
        )

    def error_message_from_json(self, data):
        errors = data.get("errors")
        if errors:
            return " ".join(errors)
        return "unknown error"

    def notify(self, notification, **kwargs):
        event = notification.event
        group = event.group
        project = group.project
        priority = int(self.get_option("priority", project) or 0)
        retry = int(self.get_option("retry", project) or 30)
        expire = int(self.get_option("expire", project) or 90)

        title = u"%s: %s" % (project.name, group.title)
        link = group.get_absolute_url(params={"referrer": "pushover_plugin"})

        message = event.title[:256]

        tags = event.tags
        if tags:
            message += u"\n\nTags: %s" % (", ".join("%s=%s" % (k, v) for (k, v) in tags))

        client = self.get_client(project)
        try:
            response = client.send_message(
                {
                    "message": message[:1024],
                    "title": title[:250],
                    "url": link,
                    "url_title": "Issue Details",
                    "priority": priority,
                    "retry": retry,
                    "expire": expire,
                }
            )
        except Exception as e:
            self.raise_error(e)
        assert response["status"]
