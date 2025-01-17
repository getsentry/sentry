from unittest import mock
from uuid import uuid4

import orjson
import responses
from django.core.exceptions import ValidationError
from requests.exceptions import HTTPError

from sentry.integrations.discord.actions.issue_alert.form import DiscordNotifyServiceForm
from sentry.integrations.discord.actions.issue_alert.notification import DiscordNotifyServiceAction
from sentry.integrations.discord.client import MESSAGE_URL
from sentry.integrations.discord.message_builder import LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.base.component import DiscordComponentCustomIds
from sentry.integrations.messaging.message_builder import (
    build_attachment_title,
    build_footer,
    get_title_link,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import EventLifecycleOutcome, ExternalProviders
from sentry.models.group import GroupStatus
from sentry.models.release import Release
from sentry.shared_integrations.exceptions import ApiTimeoutError
from sentry.testutils.asserts import assert_slo_metric
from sentry.testutils.cases import RuleTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class DiscordIssueAlertTest(RuleTestCase):
    rule_cls = DiscordNotifyServiceAction

    def setUp(self):
        self.guild_id = "guild-id"
        self.channel_id = "12345678910"
        self.discord_user_id = "user1234"
        self.discord_integration = self.create_integration(
            provider="discord",
            name="Cool server",
            external_id=self.guild_id,
            organization=self.organization,
        )
        self.provider = self.create_identity_provider(integration=self.discord_integration)
        self.identity = self.create_identity(
            user=self.user, identity_provider=self.provider, external_id=self.discord_user_id
        )
        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Event message",
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=self.project.id,
        )
        self.tags = "environment, user"
        self.rule = self.get_rule(
            data={
                "server": self.discord_integration.id,
                "channel_id": self.channel_id,
                "tags": self.tags,
            }
        )

        responses.add(
            method=responses.POST,
            url=f"{MESSAGE_URL.format(channel_id=self.channel_id)}",
            status=200,
        )

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def assert_lifecycle_metrics(self, mock_record_event):
        notification_uuid = str(uuid4())
        self.rule.after(self.event, notification_uuid=notification_uuid)

        assert_slo_metric(mock_record_event)

    @mock.patch(
        "sentry.integrations.discord.client.DiscordClient.send_message", side_effect=Exception
    )
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def assert_lifecycle_metrics_failure(self, mock_record_event, mock_send_message):
        self.rule.after(self.event)
        assert_slo_metric(mock_record_event, EventLifecycleOutcome.FAILURE)

    @mock.patch(
        "sentry.integrations.discord.client.DiscordClient.send_message",
        side_effect=HTTPError(429),
    )
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def assert_lifecycle_metrics_halt_for_rate_limit(self, mock_record_event, mock_send_message):
        self.rule.after(self.event)
        assert_slo_metric(mock_record_event, EventLifecycleOutcome.HALTED)

    @responses.activate
    @mock.patch("sentry.analytics.record")
    def test_basic(self, mock_record):
        notification_uuid = str(uuid4())
        results = list(self.rule.after(self.event, notification_uuid=notification_uuid))
        assert len(results) == 1

        results[0].callback(self.event, futures=[])

        body = responses.calls[0].request.body
        data = orjson.loads(body)

        embed = data["embeds"][0]
        assert embed == {
            "title": build_attachment_title(self.event.group),
            "url": get_title_link(
                self.event.group,
                self.event,
                False,
                False,
                None,
                ExternalProviders.DISCORD,
                notification_uuid=notification_uuid,
            ),
            "color": LEVEL_TO_COLOR["error"],
            "footer": {"text": build_footer(self.event.group, self.event.project, None, "{text}")},
            "fields": [],
            "timestamp": self.event.timestamp,
        }

        buttons = data["components"][0]["components"]
        assert (
            buttons[0]["custom_id"] == f"{DiscordComponentCustomIds.RESOLVE}:{self.event.group.id}"
        )
        assert (
            buttons[1]["custom_id"] == f"{DiscordComponentCustomIds.ARCHIVE}:{self.event.group.id}"
        )
        assert (
            buttons[2]["custom_id"]
            == f"{DiscordComponentCustomIds.ASSIGN_DIALOG}:{self.event.group.id}"
        )
        mock_record.assert_any_call(
            "integrations.discord.notification_sent",
            category="issue_alert",
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=self.event.group_id,
            notification_uuid=notification_uuid,
            alert_id=None,
        )
        mock_record.assert_called_with(
            "alert.sent",
            provider="discord",
            alert_id="",
            alert_type="issue_alert",
            organization_id=self.organization.id,
            project_id=self.project.id,
            external_id=self.channel_id,
            notification_uuid=notification_uuid,
        )

    @responses.activate
    def test_has_releases(self):
        release = Release.objects.create(
            organization_id=self.organization.id,
            version="1.0",
        )
        release.add_project(self.project)

        results = list(self.rule.after(self.event))
        assert len(results) == 1

        results[0].callback(self.event, futures=[])

        body = responses.calls[0].request.body
        data = orjson.loads(body)

        buttons = data["components"][0]["components"]
        assert (
            buttons[0]["custom_id"]
            == f"{DiscordComponentCustomIds.RESOLVE_DIALOG}:{self.event.group.id}"
        )
        assert (
            buttons[1]["custom_id"] == f"{DiscordComponentCustomIds.ARCHIVE}:{self.event.group.id}"
        )
        assert (
            buttons[2]["custom_id"]
            == f"{DiscordComponentCustomIds.ASSIGN_DIALOG}:{self.event.group.id}"
        )

    @responses.activate
    @mock.patch(
        "sentry.integrations.discord.message_builder.issues.Group.get_status",
        return_value=GroupStatus.RESOLVED,
    )
    def test_resolved(self, mock_get_status):
        results = list(self.rule.after(self.event))
        assert len(results) == 1

        results[0].callback(self.event, futures=[])

        body = responses.calls[0].request.body
        data = orjson.loads(body)

        buttons = data["components"][0]["components"]
        assert (
            buttons[0]["custom_id"]
            == f"{DiscordComponentCustomIds.UNRESOLVE}:{self.event.group.id}"
        )
        assert (
            buttons[1]["custom_id"] == f"{DiscordComponentCustomIds.ARCHIVE}:{self.event.group.id}"
        )
        assert (
            buttons[2]["custom_id"]
            == f"{DiscordComponentCustomIds.ASSIGN_DIALOG}:{self.event.group.id}"
        )

    @responses.activate
    @mock.patch(
        "sentry.integrations.discord.message_builder.issues.Group.get_status",
        return_value=GroupStatus.IGNORED,
    )
    def test_ignored(self, mock_get_status):
        results = list(self.rule.after(self.event))
        assert len(results) == 1

        results[0].callback(self.event, futures=[])

        body = responses.calls[0].request.body
        data = orjson.loads(body)

        buttons = data["components"][0]["components"]
        assert (
            buttons[0]["custom_id"] == f"{DiscordComponentCustomIds.RESOLVE}:{self.event.group.id}"
        )
        assert (
            buttons[1]["custom_id"]
            == f"{DiscordComponentCustomIds.MARK_ONGOING}:{self.event.group.id}"
        )
        assert (
            buttons[2]["custom_id"]
            == f"{DiscordComponentCustomIds.ASSIGN_DIALOG}:{self.event.group.id}"
        )

    @responses.activate
    def test_feature_flag_disabled(self):
        results = list(self.rule.after(self.event))
        assert len(results) == 1
        results[0].callback(self.event, futures=[])

        responses.assert_call_count(f"{MESSAGE_URL.format(channel_id=self.channel_id)}", 0)

    @responses.activate
    def test_integration_removed(self):
        integration_service.delete_integration(integration_id=self.discord_integration.id)
        results = list(self.rule.after(self.event))
        assert len(results) == 0

    @responses.activate
    @mock.patch(
        "sentry.integrations.discord.actions.issue_alert.form.validate_channel_id",
        return_value=None,
    )
    def test_get_form_instance(self, mock_validate_channel_id):
        form = self.rule.get_form_instance()
        form.full_clean()
        assert form.is_valid()
        assert int(form.cleaned_data["server"]) == self.discord_integration.id
        assert form.cleaned_data["channel_id"] == self.channel_id
        assert form.cleaned_data["tags"] == self.tags
        assert mock_validate_channel_id.call_count == 1

    @responses.activate
    def test_label(self):
        label = self.rule.render_label()
        assert (
            label
            == f"Send a notification to the Cool server Discord server in the channel with ID or URL: {self.channel_id} and show tags [{self.tags}] in the notification."
        )


class DiscordNotifyServiceFormTest(TestCase):
    def setUp(self):
        self.guild_id = "guild-id"
        self.channel_id = "12345678910"
        self.discord_integration = self.create_integration(
            provider="discord",
            name="Cool server",
            external_id=self.guild_id,
            organization=self.organization,
        )
        self.other_integration = self.create_integration(
            provider="discord",
            name="Uncool server",
            external_id="different-guild-id",
            organization=self.organization,
        )
        self.integrations = [self.discord_integration, self.other_integration]

        self.form = DiscordNotifyServiceForm(
            data={
                "server": self.discord_integration.id,
                "channel_id": self.channel_id,
            },
            integrations=self.integrations,
        )

    def test_has_choices(self):
        form = DiscordNotifyServiceForm(integrations=self.integrations)
        assert form.fields["server"].choices == [  # type: ignore[attr-defined]
            (self.discord_integration.id, self.discord_integration.name),
            (self.other_integration.id, self.other_integration.name),
        ]

    @mock.patch(
        "sentry.integrations.discord.actions.issue_alert.form.validate_channel_id",
        return_value=None,
    )
    def test_valid(self, mock_validate_channel_id):
        self.form.full_clean()
        assert self.form.is_valid()
        assert mock_validate_channel_id.call_count == 1

    @mock.patch(
        "sentry.integrations.discord.actions.issue_alert.form.get_channel_id_from_url",
        return_value="",
    )
    def test_no_channel_id(self, mock_get_channel_id_from_url):
        self.form.full_clean()
        assert not self.form.is_valid()
        assert mock_get_channel_id_from_url.call_count == 1

    def test_no_server(self):
        form = DiscordNotifyServiceForm(integrations=self.integrations)
        form.full_clean()
        assert not form.is_valid()

    @mock.patch(
        "sentry.integrations.discord.actions.issue_alert.form.validate_channel_id",
        return_value=None,
    )
    def test_no_tags(self, mock_validate_channel_id):
        self.form.full_clean()
        assert self.form.is_valid()
        assert mock_validate_channel_id.call_count == 1

    @mock.patch(
        "sentry.integrations.discord.actions.issue_alert.form.validate_channel_id",
        side_effect=ValidationError("bad"),
    )
    def test_invalid_channel_id(self, mock_validate_channel_id):
        self.form.full_clean()
        assert not self.form.is_valid()
        assert mock_validate_channel_id.call_count == 1

    @mock.patch(
        "sentry.integrations.discord.actions.issue_alert.form.validate_channel_id",
        side_effect=ApiTimeoutError("Discord channel lookup timed out"),
    )
    def test_channel_id_lookup_timeout(self, mock_validate_channel_id):
        form = DiscordNotifyServiceForm(
            data={
                "server": self.discord_integration.id,
                "channel_id": self.channel_id,
                "tags": "environment",
            },
            integrations=self.integrations,
        )

        form.full_clean()
        assert not form.is_valid()
        assert mock_validate_channel_id.call_count == 1

    def test_get_channel_id_bad(self):
        form = DiscordNotifyServiceForm(
            data={
                "server": self.discord_integration.id,
                "channel_id": "https://discord.com/channels/server/",
                "tags": "environment",
            },
            integrations=self.integrations,
        )

        form.full_clean()
        assert not form.is_valid()

    @mock.patch(
        "sentry.integrations.discord.actions.issue_alert.form.validate_channel_id",
        return_value=None,
    )
    def test_get_channel_id_updates(self, mock_validate_channel_id):
        form = DiscordNotifyServiceForm(
            data={
                "server": self.discord_integration.id,
                "channel_id": "https://discord.com/channels/server/12345678910",
                "tags": "environment",
            },
            integrations=self.integrations,
        )
        form.full_clean()
        assert form.is_valid()
        assert form.cleaned_data["channel_id"] == "12345678910"
        assert mock_validate_channel_id.call_count == 1
