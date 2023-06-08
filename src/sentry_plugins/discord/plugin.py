from rest_framework import status

from sentry import tagstore
from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.plugins.base import Notification
from sentry.plugins.bases import notify
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.http import absolute_uri
from sentry_plugins.base import CorePluginMixin

from .client import DiscordWebhookClient

LEVEL_TO_COLOR = {
    "_actioned_issue": "15593199",
    "_incident_resolved": "5097329",
    "debug": "16507215",
    "error": "14695983",
    "fatal": "16402247",
    "info": "2590926",
    "warning": "16761383",
}
IGNORABLE_DISCORD_ERROR_CODES = [
    status.HTTP_404_NOT_FOUND,
    status.HTTP_429_TOO_MANY_REQUESTS,
]


class DiscordPlugin(CorePluginMixin, notify.NotificationPlugin):
    title = "Discord"
    slug = "discord"
    description = "Post notifications to a discord webhook."
    conf_key = "discord"
    required_field = "webhook"
    feature_descriptions = [
        FeatureDescription(
            """
            Configure rule based discord notifications to automatically be posted.
            Want any error that's happening more than 100 times a
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
                "placeholder": "e.g. https://discord.com/api/webhooks/0000000000000000000/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA-BBBBBBBBBBBB_CCCCCCCCCCCCCCCCCCCCCCC",
                "required": True,
                "help": "Your custom Discord webhook URL.",
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
                "name": "avatar_url",
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
                "name": "custom_message",
                "label": "Custom Message",
                "type": "string",
                "placeholder": "e.g. Hey <!everyone> there is something wrong",
                "required": False,
                "help": (
                    "Optional - Discord message formatting is respected, "
                    "so is <@userid>, <#channelid>, @here and @everyone."
                ),
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
        return LEVEL_TO_COLOR.get(event.get_tag("level"), "error")

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
        return {tag.strip().lower() for tag in option.split(",")}

    def notify(self, notification: Notification, raise_exception: bool = False) -> None:
        event = notification.event
        group = event.group
        project = group.project

        if not self.is_configured(project):
            return

        title = event.title
        # TODO(dcramer): we'd like this to be the event culprit, but Sentry
        # does not currently retain it
        if group.culprit:
            culprit = group.culprit
        else:
            culprit = None
        project_name = project.get_full_name()

        fields = []

        # They can be the same if there is no culprit
        # So we set culprit to an empty string instead of duplicating the text
        if not self.get_option("exclude_culprit", project) and culprit and title != culprit:
            fields.append({"name": "Culprit", "value": culprit, "inline": False})
        if not self.get_option("exclude_project", project):
            fields.append({"name": "Project", "value": project_name, "inline": True})

        if self.get_option("include_rules", project):
            rules = []
            for rule in notification.rules:
                rule_link = (
                    f"/{group.organization.slug}/{project.slug}/settings/alerts/rules/{rule.id}/"
                )

                # Make sure it's an absolute uri since we're sending this
                # outside of Sentry into Discord
                rule_link = absolute_uri(rule_link)
                rules.append((rule_link, rule.label))

            if rules:
                value = ", ".join("<{} | {}>".format(*r) for r in rules)

                fields.append({"name": "Triggered By", "value": value, "inline": False})

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
                        "name": tag_key,
                        "value": tag_value,
                        "inline": True,
                    }
                )
        payload = {
            "content": self.get_option("custom_message", project) or "",
            "embeds": [
                {
                    "title": title,
                    "url": group.get_absolute_url(params={"referrer": "discord"}),
                    "color": self.color_for_event(event),
                    "fields": fields,
                }
            ],
        }

        username = (self.get_option("username", project) or "Sentry").strip()
        avatar_url = self.get_option("avatar_url", project)
        channel = (self.get_option("channel", project) or "").strip()

        if username:
            payload["username"] = username

        if channel:
            payload["channel"] = channel

        if avatar_url:
            payload["avatar_url"] = avatar_url

        client = self.get_client(project)

        try:
            client.request(data=payload)
        except ApiError as e:
            if raise_exception or (e.code not in IGNORABLE_DISCORD_ERROR_CODES):
                raise e

    def get_client(self, project):
        webhook = self.get_option("webhook", project).strip()
        return DiscordWebhookClient(webhook)
