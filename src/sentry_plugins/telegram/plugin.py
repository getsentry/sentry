from __future__ import annotations

from typing import Any

from django import forms
from django.utils.translation import gettext_lazy as _

import sentry
from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.plugins.bases.notify import NotificationPlugin
from sentry_plugins.base import CorePluginMixin

from .client import TelegramApiClient

DESCRIPTION = """
Get notified of Sentry alerts via Telegram.
"""


class TelegramConfigurationForm(forms.Form):
    api_key = forms.CharField(
        label=_("Api Key"),
        required=True,
        widget=forms.PasswordInput(render_value=True, attrs={"class": "span6"}),
    )
    group_id = forms.CharField(
        label=_("Group ID"), required=True,
        widget=forms.TextInput(attrs={"class": "span6", "placeholder": "e.g. -100174934319"})
    )
    topic_id = forms.CharField(
        label=_("Topic ID"), required=False, widget=forms.TextInput(attrs={"class": "span6", "placeholder": "e.g. 65"})
    )
    silent = forms.BooleanField(
        label=_("silent"),
        help_text=_(
            "By default, silent enable."
        ),
        widget=forms.CheckboxInput(),
        required=False,
        initial=True,
    )

    def clean(self) -> dict[str, Any] | None:
        # TODO: Ping Telegram and check credentials (?)
        return self.cleaned_data


class TelegramPlugin(CorePluginMixin, NotificationPlugin):
    version = sentry.VERSION
    description = DESCRIPTION
    resource_links = [
        (
            "Documentation",
            "https://github.com/tianci-sh/sentry-telegram/blob/master/Telegram_Instructions.md",
        ),
        ("Report Issue", "https://github.com/tianci-sh/sentry-telegram/issues"),
        (
            "View Source",
            "https://github.com/tianci-sh/sentry-telegram",
        ),
        ("Telegram", "https://www.telegram.com/"),
        ("Telegram Document", "https://core.telegram.org/bots#3-how-do-i-create-a-bot"),
    ]

    slug = "Telegram"
    title = _("Telegram (Bot)")
    conf_title = title
    conf_key = "Telegram"
    required_field = "api_key"
    project_conf_form = TelegramConfigurationForm
    feature_descriptions = [
        FeatureDescription(
            """
            Configure Sentry rules to trigger notifications based on conditions you set.
            """,
            IntegrationFeatures.ALERT_RULE,
        ),
    ]

    def is_configured(self, project, **kwargs):
        return all(
            [
                self.get_option(o, project)
                for o in ("api_key", "group_id")
            ]
        )

    def get_send_to(self, *args, **kwargs):
        # This doesn't depend on email permission... stuff.
        return True

    def error_message_from_json(self, data):
        code = data.get("code")
        message = data.get("message")
        more_info = data.get("more_info")
        error_message = f"{code} - {message} {more_info}"
        if message:
            return error_message
        return None

    def notify_users(self, group, event, **kwargs):
        if not self.is_configured(group.project):
            return
        project = group.project

        client = self.get_client(group.project)

        body = "*[Sentry]* {project_name}\n{level}: *{title}*\n``` {message}```\n\n{url}".format(
            project_name=project.name,
            level=event.group.get_level_display().upper(),
            title=event.title.splitlines()[0],
            message=event.message,
            url=group.get_absolute_url()
        )

        payload = {
            "message_thread_id": client.topic_id,
            "text": body,
            "chat_id": client.group_id,
            "parse_mode": "markdown",
            "disable_notification": client.silent
        }

        try:
            client.request(payload)
        except Exception as e:
            self.raise_error(e)

    def get_client(self, project):
        group_id = self.get_option("group_id", project)
        api_key = self.get_option("api_key", project)
        topic_id = self.get_option("topic_id", project)
        silent = self.get_option("silent", project)

        return TelegramApiClient(api_key=api_key, group_id=group_id, topic_id=topic_id, silent=silent)