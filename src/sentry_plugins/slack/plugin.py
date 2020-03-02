from __future__ import absolute_import

from sentry import tagstore
from sentry.plugins.bases import notify
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.integrations import FeatureDescription, IntegrationFeatures

from .client import SlackApiClient
from sentry_plugins.base import CorePluginMixin

LEVEL_TO_COLOR = {
    "debug": "cfd3da",
    "info": "2788ce",
    "warning": "f18500",
    "error": "f43f20",
    "fatal": "d20f2a",
}


class SlackPlugin(CorePluginMixin, notify.NotificationPlugin):
    title = "Slack"
    slug = "slack"
    description = "Post notifications to a Slack channel."
    conf_key = "slack"
    required_field = "webhook"
    feature_descriptions = [
        FeatureDescription(
            """
            Configure rule based Slack notifications to automatically be posted into a
            specific channel. Want any error that's happening more than 100 times a
            minute to be posted in `#critical-errors`? Setup a rule for it!
            """,
            IntegrationFeatures.ALERT_RULE,
        )
    ]

    def is_configured(self, project):
        return bool(self.get_option("webhook", project))

    def get_config(self, project, **kwargs):
        return [
            {
                "name": "webhook",
                "label": "Webhook URL",
                "type": "url",
                "placeholder": "e.g. https://hooks.slack.com/services/000000000/000000000/00000000000000000",
                "required": True,
                "help": "Your custom Slack webhook URL.",
            },
            {
                "name": "username",
                "label": "Bot Name",
                "type": "string",
                "placeholder": "e.g. Sentry",
                "default": "Sentry",
                "required": False,
                "help": "The name used when publishing messages.",
            },
            {
                "name": "icon_url",
                "label": "Icon URL",
                "type": "url",
                "required": False,
                "help": (
                    "The url of the icon to appear beside your bot (32px png), "
                    "leave empty for none.<br />You may use "
                    "http://myovchev.github.io/sentry-slack/images/logo32.png"
                ),
            },
            {
                "name": "channel",
                "label": "Destination",
                "type": "string",
                "placeholder": "e.g. #engineering",
                "required": False,
                "help": "Optional #channel name or @user",
            },
            {
                "name": "custom_message",
                "label": "Custom Message",
                "type": "string",
                "placeholder": "e.g. Hey <!everyone> there is something wrong",
                "required": False,
                "help": "Optional - Slack message formatting can be used",
            },
            {
                "name": "include_tags",
                "label": "Include Tags",
                "type": "bool",
                "required": False,
                "help": "Include tags with notifications",
            },
            {
                "name": "included_tag_keys",
                "label": "Included Tags",
                "type": "string",
                "required": False,
                "help": (
                    "Only include these tags (comma separated list). " "Leave empty to include all."
                ),
            },
            {
                "name": "excluded_tag_keys",
                "label": "Excluded Tags",
                "type": "string",
                "required": False,
                "help": "Exclude these tags (comma separated list).",
            },
            {
                "name": "include_rules",
                "label": "Include Rules",
                "type": "bool",
                "required": False,
                "help": "Include triggering rules with notifications.",
            },
            {
                "name": "exclude_project",
                "label": "Exclude Project Name",
                "type": "bool",
                "default": False,
                "required": False,
                "help": "Exclude project name with notifications.",
            },
            {
                "name": "exclude_culprit",
                "label": "Exclude Culprit",
                "type": "bool",
                "default": False,
                "required": False,
                "help": "Exclude culprit with notifications.",
            },
        ]

    def color_for_event(self, event):
        return "#" + LEVEL_TO_COLOR.get(event.get_tag("level"), "error")

    def _get_tags(self, event):
        tag_list = event.tags
        if not tag_list:
            return ()

        return (
            (tagstore.get_tag_key_label(k), tagstore.get_tag_value_label(k, v)) for k, v in tag_list
        )

    def get_tag_list(self, name, project):
        option = self.get_option(name, project)
        if not option:
            return None
        return set(tag.strip().lower() for tag in option.split(","))

    def notify(self, notification, raise_exception=False):
        event = notification.event
        group = event.group
        project = group.project

        if not self.is_configured(project):
            return

        title = event.title.encode("utf-8")
        # TODO(dcramer): we'd like this to be the event culprit, but Sentry
        # does not currently retain it
        if group.culprit:
            culprit = group.culprit.encode("utf-8")
        else:
            culprit = None
        project_name = project.get_full_name().encode("utf-8")

        fields = []

        # They can be the same if there is no culprit
        # So we set culprit to an empty string instead of duplicating the text
        if not self.get_option("exclude_culprit", project) and culprit and title != culprit:
            fields.append({"title": "Culprit", "value": culprit, "short": False})
        if not self.get_option("exclude_project", project):
            fields.append({"title": "Project", "value": project_name, "short": True})

        if self.get_option("custom_message", project):
            fields.append(
                {
                    "title": "Custom message",
                    "value": self.get_option("custom_message", project),
                    "short": False,
                }
            )

        if self.get_option("include_rules", project):
            rules = []
            for rule in notification.rules:
                rule_link = "/%s/%s/settings/alerts/rules/%s/" % (
                    group.organization.slug,
                    project.slug,
                    rule.id,
                )

                # Make sure it's an absolute uri since we're sending this
                # outside of Sentry into Slack
                rule_link = absolute_uri(rule_link)
                rules.append((rule_link, rule.label))

            if rules:
                value = u", ".join(u"<{} | {}>".format(*r) for r in rules)

                fields.append(
                    {"title": "Triggered By", "value": value.encode("utf-8"), "short": False}
                )

        if self.get_option("include_tags", project):
            included_tags = set(self.get_tag_list("included_tag_keys", project) or [])
            excluded_tags = set(self.get_tag_list("excluded_tag_keys", project) or [])
            for tag_key, tag_value in self._get_tags(event):
                key = tag_key.lower()
                std_key = tagstore.get_standardized_key(key)
                if included_tags and key not in included_tags and std_key not in included_tags:
                    continue
                if excluded_tags and (key in excluded_tags or std_key in excluded_tags):
                    continue
                fields.append(
                    {
                        "title": tag_key.encode("utf-8"),
                        "value": tag_value.encode("utf-8"),
                        "short": True,
                    }
                )
        payload = {
            "attachments": [
                {
                    "fallback": "[%s] %s" % (project_name, title),
                    "title": title,
                    "title_link": group.get_absolute_url(params={"referrer": "slack"}),
                    "color": self.color_for_event(event),
                    "fields": fields,
                }
            ]
        }
        client = self.get_client(project)

        if client.username:
            payload["username"] = client.username.encode("utf-8")

        if client.channel:
            payload["channel"] = client.channel

        if client.icon_url:
            payload["icon_url"] = client.icon_url

        values = {"payload": json.dumps(payload)}
        client.request(values)

    def get_client(self, project):
        webhook = self.get_option("webhook", project).strip()
        # Apparently we've stored some bad data from before we used `URLField`.
        username = (self.get_option("username", project) or "Sentry").strip()
        icon_url = self.get_option("icon_url", project)
        channel = (self.get_option("channel", project) or "").strip()

        return SlackApiClient(webhook, username, icon_url, channel)
