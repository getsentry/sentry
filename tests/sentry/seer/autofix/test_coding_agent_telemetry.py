from unittest.mock import Mock, patch

import sentry_sdk
from django.test import override_settings
from sentry_sdk.transport import Transport

from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.autofix.coding_agent_telemetry import (
    _capture_span,
    record_handoff_event,
    record_pr_lifecycle_from_github_webhook,
)
from sentry.seer.models.run import SeerRunType
from sentry.testutils.cases import TestCase


class RecordHandoffEventTest(TestCase):
    def setUp(self) -> None:
        self.seer_run = self.create_seer_run(
            self.organization,
            type=SeerRunType.FEATURE_RUN,
            seer_run_state_id=123,
        )
        self.handoff = self.create_seer_run_coding_agent_handoff(
            self.seer_run,
            agent_id="sesn_123",
            provider="claude_code_agent",
            status="completed",
            extras={
                "repository": "getsentry/sentry",
                "auto_create_pr": True,
                "agent_name": "Sentry Autofix Agent",
            },
        )

    @patch("sentry.seer.autofix.coding_agent_telemetry._capture_span")
    def test_emits_joinable_claude_attributes(self, mock_capture: Mock) -> None:
        record_handoff_event(event="completed", handoff=self.handoff)

        attributes = mock_capture.call_args.args[0]
        assert attributes["anthropic.session.id"] == "sesn_123"
        assert attributes["seer.handoff.event"] == "completed"
        assert attributes["seer.coding_agent.provider"] == "claude_code_agent"
        assert attributes["seer.repository.full_name"] == "getsentry/sentry"
        assert attributes["seer.handoff.auto_create_pr"] is True
        assert attributes["seer.coding_agent.name"] == "Sentry Autofix Agent"
        assert attributes["run_id"] == 123

    @override_settings(SEER_CODING_AGENT_TELEMETRY_DSN="https://public@example.com/6178942")
    @patch("sentry.seer.autofix.coding_agent_telemetry.use_scope")
    @patch("sentry.seer.autofix.coding_agent_telemetry.Scope")
    @patch("sentry.seer.autofix.coding_agent_telemetry._get_client")
    def test_uses_an_isolated_dedicated_client(
        self, mock_get_client: Mock, mock_scope_class: Mock, mock_use_scope: Mock
    ) -> None:
        client = mock_get_client.return_value
        scope = mock_scope_class.return_value

        _capture_span({"anthropic.session.id": "sesn_123"})

        mock_get_client.assert_called_once_with("https://public@example.com/6178942")
        mock_scope_class.assert_called_once_with(client=client)
        mock_use_scope.assert_called_once_with(scope)
        scope.start_streamed_span.assert_called_once_with(
            name="Seer coding agent handoff lifecycle",
            attributes={
                "sentry.op": "seer.coding_agent_handoff",
                "anthropic.session.id": "sesn_123",
            },
            parent_span=None,
            active=False,
        )

    @override_settings(SEER_CODING_AGENT_TELEMETRY_DSN="https://public@example.com/6178942")
    def test_captures_a_streamed_span_envelope(self) -> None:
        class RecordingTransport(Transport):
            def __init__(self) -> None:
                super().__init__()
                self.envelopes = []

            def capture_envelope(self, envelope) -> None:
                self.envelopes.append(envelope)

        transport = RecordingTransport()
        client = sentry_sdk.Client(
            dsn="https://public@example.com/6178942",
            transport=transport,
            default_integrations=False,
            traces_sample_rate=1.0,
            trace_lifecycle="stream",
        )

        with patch("sentry.seer.autofix.coding_agent_telemetry._get_client", return_value=client):
            _capture_span({"anthropic.session.id": "sesn_123"})
            client.flush(timeout=1)

        assert len(transport.envelopes) == 1
        assert [item.type for item in transport.envelopes[0].items] == ["span"]

    @patch("sentry.seer.autofix.coding_agent_telemetry.record_handoff_event")
    def test_terminal_pr_webhook_is_idempotent(self, mock_record: Mock) -> None:
        repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        pull_request = self.create_pull_request(
            repository_id=repo.id,
            organization_id=self.organization.id,
            key="42",
        )
        pull_request.state = PullRequestLifecycleState.MERGED
        pull_request.save(update_fields=["state"])
        self.create_seer_run_pull_request(
            self.seer_run,
            pull_request=pull_request,
            coding_agent_handoff=self.handoff,
        )
        event = {
            "action": "closed",
            "pull_request": {
                "number": 42,
                "merged": True,
                "html_url": "https://github.com/getsentry/sentry/pull/42",
            },
        }

        kwargs = {
            "github_event": "pull_request",
            "event": event,
            "organization": self.organization,
            "repo": repo,
        }
        record_pr_lifecycle_from_github_webhook(**kwargs)
        record_pr_lifecycle_from_github_webhook(**kwargs)

        mock_record.assert_called_once_with(
            event="pr_merged",
            handoff=self.handoff,
            pull_request=pull_request,
            pr_url="https://github.com/getsentry/sentry/pull/42",
        )
        self.handoff.refresh_from_db()
        assert self.handoff.extras["telemetry_events"] == [f"pr_merged:{pull_request.id}"]
