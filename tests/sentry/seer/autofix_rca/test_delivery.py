from unittest.mock import patch
from uuid import UUID

from sentry.seer.autofix_rca.delivery import deliver_autofix_rca_result
from sentry.seer.models.run import SeerAgentRun
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all

VALID_RESULT = {
    "artifact": {
        "one_line_description": "null deref in handler",
        "five_whys": ["a", "b", "c"],
        "reproduction_steps": ["do x"],
        "relevant_repo": "owner/repo",
    },
    "introspection_decision": {"action": "continue", "reason": "matches the stacktrace"},
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
        assert stored["introspection_decision"]["action"] == "continue"
        assert stored["artifact"]["one_line_description"] == "null deref in handler"

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

    def test_invalid_result_logs_exception(self) -> None:
        agent_run = self._create_agent_run()

        with patch("sentry.seer.autofix_rca.delivery.logger") as mock_logger:
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=agent_run.run.uuid,
                status="completed",
                result={"introspection_decision": {"action": "not-a-real-action"}},
                error=None,
            )

        mock_logger.exception.assert_called_once()
        assert "autofix_rca.delivery.invalid_result" in mock_logger.exception.call_args.args[0]

        agent_run.refresh_from_db()
        assert "status" not in agent_run.extras

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
