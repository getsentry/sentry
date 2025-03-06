from unittest.mock import patch

import orjson
import responses

from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.discord.client import CHANNEL_URL, DISCORD_BASE_URL, MESSAGE_URL
from sentry.integrations.discord.spec import DiscordMessagingSpec
from sentry.integrations.messaging.spec import MessagingActionHandler
from sentry.integrations.types import EventLifecycleOutcome
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError
from sentry.testutils.asserts import assert_slo_metric
from sentry.testutils.helpers.datetime import freeze_time

from . import FireTest


@freeze_time()
class DiscordActionHandlerTest(FireTest):
    @responses.activate
    def setUp(self):
        self.spec = DiscordMessagingSpec()

        self.guild_id = "guild-id"
        self.channel_id = "12345678910"
        self.discord_user_id = "user1234"

        responses.add(
            method=responses.GET,
            url=f"{DISCORD_BASE_URL}{CHANNEL_URL.format(channel_id=self.channel_id)}",
            json={"type": 0, "guild_id": self.guild_id},
            status=200,
        )
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

        self.action = self.create_alert_rule_trigger_action(
            target_identifier=self.channel_id,
            type=AlertRuleTriggerAction.Type.DISCORD,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.discord_integration,
        )

    @responses.activate
    def run_test(self, incident, method):
        responses.add(
            method=responses.POST,
            url=f"{DISCORD_BASE_URL}{MESSAGE_URL.format(channel_id=self.channel_id)}",
            json={},
            status=200,
        )

        handler = MessagingActionHandler(self.action, incident, self.project, self.spec)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))

        data = orjson.loads(responses.calls[0].request.body)
        return data

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")

    @responses.activate
    def test_rule_snoozed(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        self.snooze_rule(alert_rule=alert_rule)

        responses.add(
            method=responses.POST,
            url=f"{DISCORD_BASE_URL}{MESSAGE_URL.format(channel_id=self.channel_id)}",
            json={},
            status=200,
        )

        handler = MessagingActionHandler(self.action, incident, self.project, self.spec)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus(incident.status))

        assert len(responses.calls) == 0

    @responses.activate
    @patch("sentry.integrations.discord.client.DiscordClient.send_message", side_effect=Exception)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_metric_alert_failure(self, mock_record_event, mock_send_message):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        handler = MessagingActionHandler(self.action, incident, self.project, self.spec)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus.WARNING)

        assert_slo_metric(mock_record_event, EventLifecycleOutcome.FAILURE)

    @patch(
        "sentry.integrations.discord.client.DiscordClient.send_message",
        side_effect=ApiRateLimitedError(text="Rate limited"),
    )
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_metric_alert_halt_for_rate_limited(self, mock_record_event, mock_send_message):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        handler = MessagingActionHandler(self.action, incident, self.project, self.spec)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus.WARNING)

        assert_slo_metric(mock_record_event, EventLifecycleOutcome.HALTED)

    @patch(
        "sentry.integrations.discord.client.DiscordClient.send_message",
        side_effect=ApiError(
            code=403,
            text='{"message": "Missing access", "code": 50001}',
        ),
    )
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_metric_alert_halt_for_missing_access(self, mock_record_event, mock_send_message):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        handler = MessagingActionHandler(self.action, incident, self.project, self.spec)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus.WARNING)

        assert_slo_metric(mock_record_event, EventLifecycleOutcome.HALTED)

    @patch(
        "sentry.integrations.discord.client.DiscordClient.send_message",
        side_effect=ApiError(code=400, text="Bad request"),
    )
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_metric_alert_halt_for_other_api_error(self, mock_record_event, mock_send_message):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        handler = MessagingActionHandler(self.action, incident, self.project, self.spec)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus.WARNING)

        assert_slo_metric(mock_record_event, EventLifecycleOutcome.FAILURE)
