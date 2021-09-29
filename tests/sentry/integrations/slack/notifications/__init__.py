from urllib.parse import parse_qs

import responses
from exam import fixture

from sentry.integrations.slack.notifications import send_notification_as_slack
from sentry.mail import mail_adapter
from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    NotificationSetting,
    UserOption,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from tests.sentry.integrations.slack import install_slack
from tests.sentry.mail.activity import ActivityTestCase


def send_notification(*args):
    args_list = list(args)[1:]
    send_notification_as_slack(*args_list, {})


def get_attachment():
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[0].request.body)
    assert "text" in data
    assert "attachments" in data
    attachments = json.loads(data["attachments"][0])

    assert len(attachments) == 1
    return attachments[0], data["text"][0]


class SlackActivityNotificationTest(ActivityTestCase):
    @fixture
    def adapter(self):
        return mail_adapter

    def setUp(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        UserOption.objects.create(user=self.user, key="self_notifications", value="1")
        self.integration = install_slack(self.organization)
        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        self.name = self.user.get_display_name()
        self.short_id = self.group.qualified_short_id
