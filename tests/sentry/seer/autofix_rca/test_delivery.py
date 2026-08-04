from unittest.mock import patch
from uuid import UUID

from sentry.analytics.events.autofix_events import AiAutofixIntrospectionEvent
from sentry.seer.autofix_rca.delivery import deliver_autofix_rca_result
from sentry.seer.models.run import SeerAgentRun
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all

# Seer delivers the root cause artifact itself as the result.
VALID_RESULT = {
    "one_line_description": "null deref in handler",
    "five_whys": ["a", "b", "c"],
    "reproduction_steps": ["do x"],
    "relevant_repo": "owner/repo",
    "fixability": {"assessment": "fixable", "reason": "matches the stacktrace"},
}


@django_db_all
class TestDeliverAutofixRCAResult(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _create_agent_run(self, seer_run_state_id: int | None = 123) -> SeerAgentRun:
        seer_run = self.create_seer_run(
            organization=self.organization,
            type="feature_run",
            seer_run_state_id=seer_run_state_id,
        )
        return self.create_seer_agent_run(
            run=seer_run,
            source="autofix_rca",
            group=self.group,
            project=self.project,
        )

    def test_missing_run_logs_warning(self) -> None:
        with patch("sentry.seer.autofix_rca.delivery.logger") as mock_logger:
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=UUID("00000000-0000-0000-0000-000000000000"),
                status="completed",
                result=VALID_RESULT,
                error=None,
            )

        mock_logger.warning.assert_called_once()
        assert "autofix_rca.delivery.missing_run" in mock_logger.warning.call_args.args[0]

    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    def test_completed_result_hooks_back_into_flow(self, mock_broadcast) -> None:
        agent_run = self._create_agent_run(seer_run_state_id=123)

        deliver_autofix_rca_result(
            organization_id=self.organization.id,
            run_uuid=agent_run.run.uuid,
            status="completed",
            result=VALID_RESULT,
            error=None,
        )

        # Persisted for evaluation.
        agent_run.refresh_from_db()
        assert agent_run.extras["status"] == "completed"
        stored = agent_run.extras["result"]
        assert stored["one_line_description"] == "null deref in handler"
        assert stored["fixability"]["assessment"] == "fixable"

        # Group marked triggered.
        self.group.refresh_from_db()
        assert self.group.seer_explorer_autofix_last_triggered is not None

        # ROOT_CAUSE_COMPLETED webhook fired with the root cause payload.
        mock_broadcast.assert_called_once()
        kwargs = mock_broadcast.call_args.kwargs
        assert kwargs["event_name"] == SeerActionType.ROOT_CAUSE_COMPLETED.value
        assert kwargs["payload"]["run_id"] == 123
        assert kwargs["payload"]["root_cause"]["one_line_description"] == "null deref in handler"

    def test_error_status_recorded(self) -> None:
        agent_run = self._create_agent_run()

        with patch("sentry.seer.autofix_rca.delivery.logger") as mock_logger:
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=agent_run.run.uuid,
                status="error",
                result=None,
                error="seer exploded",
            )

        mock_logger.warning.assert_called()
        assert "autofix_rca.delivery.no_result" in mock_logger.warning.call_args.args[0]

        agent_run.refresh_from_db()
        assert agent_run.extras["status"] == "error"
        assert agent_run.extras["error_message"] == "seer exploded"
        assert "result" not in agent_run.extras

    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    def test_artifact_off_schema_still_delivers_without_fixability(self, mock_broadcast) -> None:
        """An artifact the agent wrote off-schema (here: fixability nested under the
        wrong key) records no introspection event, but must not block the completed
        webhook -- the root cause itself is still usable."""
        agent_run = self._create_agent_run(seer_run_state_id=123)

        off_schema = {
            **VALID_RESULT,
            "fixability": {"fixability": "fixable", "reason": "wrong key"},
        }

        with patch("sentry.seer.autofix.on_completion_hook.analytics.record") as mock_record:
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=agent_run.run.uuid,
                status="completed",
                result=off_schema,
                error=None,
            )

        assert not any(
            isinstance(call.args[0], AiAutofixIntrospectionEvent)
            for call in mock_record.call_args_list
        )
        mock_broadcast.assert_called_once()
        kwargs = mock_broadcast.call_args.kwargs
        assert kwargs["event_name"] == SeerActionType.ROOT_CAUSE_COMPLETED.value
        assert kwargs["payload"]["root_cause"]["one_line_description"] == "null deref in handler"

    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    def test_fixability_records_introspection_event(self, mock_broadcast) -> None:
        agent_run = self._create_agent_run(seer_run_state_id=123)

        with patch("sentry.seer.autofix.on_completion_hook.analytics.record") as mock_record:
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=agent_run.run.uuid,
                status="completed",
                result=VALID_RESULT,
                error=None,
            )

        events = [
            call.args[0]
            for call in mock_record.call_args_list
            if isinstance(call.args[0], AiAutofixIntrospectionEvent)
        ]
        assert len(events) == 1
        assert events[0].action == "fixable"
        assert events[0].step == "root_cause"
        assert events[0].run_id == 123
        assert events[0].reached_stopping_point is True

    def test_night_shift_run_is_not_matched(self) -> None:
        """Only autofix_rca-sourced runs are handled; a night_shift run with the
        same uuid is ignored (dispatched by feature_id upstream, but be safe)."""
        seer_run = self.create_seer_run(organization=self.organization, type="feature_run")
        self.create_seer_agent_run(run=seer_run, source="night_shift", group=self.group)

        with patch("sentry.seer.autofix_rca.delivery.logger") as mock_logger:
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=seer_run.uuid,
                status="completed",
                result=VALID_RESULT,
                error=None,
            )

        mock_logger.warning.assert_called_once()
        assert "autofix_rca.delivery.missing_run" in mock_logger.warning.call_args.args[0]
