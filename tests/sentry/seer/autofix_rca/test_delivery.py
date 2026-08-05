from unittest.mock import patch
from uuid import UUID

from sentry.analytics.events.autofix_events import AiAutofixIntrospectionEvent
from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState
from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.utils import AutofixStoppingPoint
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

    def _create_agent_run(
        self,
        seer_run_state_id: int | None = 123,
        stopping_point: AutofixStoppingPoint | None = None,
    ) -> SeerAgentRun:
        seer_run = self.create_seer_run(
            organization=self.organization,
            type="feature_run",
            seer_run_state_id=seer_run_state_id,
        )
        extras: dict[str, object] = {"group_id": self.group.id, "referrer": "api.web"}
        if stopping_point is not None:
            extras["stopping_point"] = stopping_point.value
        return self.create_seer_agent_run(
            run=seer_run,
            source="autofix_rca",
            group=self.group,
            project=self.project,
            extras=extras,
        )

    def _run_state(
        self, run_id: int = 123, result: dict[str, object] | None = None
    ) -> SeerRunState:
        """The state Seer reports back for a completed feature run: a root_cause
        block carrying the artifact, and no pipeline metadata of its own."""
        return SeerRunState(
            run_id=run_id,
            blocks=[
                MemoryBlock(
                    id="block-root-cause",
                    message=Message(
                        role="assistant",
                        content="message root cause",
                        metadata={"step": "root_cause", "referrer": "api.web"},
                    ),
                    timestamp="2026-02-10T00:00:00Z",
                    artifacts=[
                        Artifact(key="root_cause", data=result or VALID_RESULT, reason="explorer"),
                    ],
                )
            ],
            status="completed",
            updated_at="2026-02-10T00:00:00Z",
            metadata={"group_id": self.group.id},
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

    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_completed_result_hooks_back_into_flow(self, mock_fetch, mock_broadcast) -> None:
        agent_run = self._create_agent_run(seer_run_state_id=123)
        mock_fetch.return_value = self._run_state()

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
        assert agent_run.extras["result"]["one_line_description"] == "null deref in handler"
        assert agent_run.extras["result"]["fixability"]["assessment"] == "fixable"

        # Group marked triggered by the hook.
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

    @patch("sentry.seer.autofix.on_completion_hook.analytics.record")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_artifact_off_schema_still_delivers_without_fixability(
        self, mock_fetch, mock_broadcast, mock_record
    ) -> None:
        """An off-schema fixability value must not block the completed webhook."""
        agent_run = self._create_agent_run(seer_run_state_id=123)
        off_schema = {
            **VALID_RESULT,
            "fixability": {"fixability": "fixable", "reason": "wrong key"},
        }
        mock_fetch.return_value = self._run_state(result=off_schema)

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

    @patch("sentry.seer.autofix.on_completion_hook.analytics.record")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_fixability_records_introspection_event(
        self, mock_fetch, mock_broadcast, mock_record
    ) -> None:
        agent_run = self._create_agent_run(seer_run_state_id=123)
        mock_fetch.return_value = self._run_state()

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

    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_redelivery_does_not_run_the_hook_twice(self, mock_fetch) -> None:
        """Seer's result push is not idempotent per run, so a redelivery must not
        re-fire the webhook or continue the pipeline a second time."""
        agent_run = self._create_agent_run(seer_run_state_id=123)
        mock_fetch.return_value = self._run_state()

        for _ in range(2):
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=agent_run.run.uuid,
                status="completed",
                result=VALID_RESULT,
                error=None,
            )

        assert mock_fetch.call_count == 1

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_stops_when_stopping_point_is_root_cause(
        self, mock_fetch, mock_broadcast, mock_trigger
    ) -> None:
        agent_run = self._create_agent_run(
            seer_run_state_id=123, stopping_point=AutofixStoppingPoint.ROOT_CAUSE
        )
        mock_fetch.return_value = self._run_state()

        deliver_autofix_rca_result(
            organization_id=self.organization.id,
            run_uuid=agent_run.run.uuid,
            status="completed",
            result=VALID_RESULT,
            error=None,
        )

        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_continues_to_solution_when_stopping_point_is_later(
        self, mock_fetch, mock_broadcast, mock_trigger
    ) -> None:
        """A feature run started with a later stopping point continues the pipeline,
        matching a run the autofix pipeline started itself. The stopping point is
        read off SeerAgentRun.extras since Seer's feature runs carry no metadata."""
        agent_run = self._create_agent_run(
            seer_run_state_id=123, stopping_point=AutofixStoppingPoint.CODE_CHANGES
        )
        mock_fetch.return_value = self._run_state()

        deliver_autofix_rca_result(
            organization_id=self.organization.id,
            run_uuid=agent_run.run.uuid,
            status="completed",
            result=VALID_RESULT,
            error=None,
        )

        mock_trigger.assert_called_once()
        call_kwargs = mock_trigger.call_args.kwargs
        assert call_kwargs["step"] == AutofixStep.SOLUTION
        assert call_kwargs["run_id"] == 123
        assert call_kwargs["group"].id == self.group.id

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_no_stopping_point_recorded_does_not_continue(
        self, mock_fetch, mock_broadcast, mock_trigger
    ) -> None:
        agent_run = self._create_agent_run(seer_run_state_id=123)
        mock_fetch.return_value = self._run_state()

        deliver_autofix_rca_result(
            organization_id=self.organization.id,
            run_uuid=agent_run.run.uuid,
            status="completed",
            result=VALID_RESULT,
            error=None,
        )

        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_continuation_matches_the_legacy_flow(
        self, mock_fetch, mock_broadcast, mock_trigger
    ) -> None:
        """The two flows must agree on where the pipeline stops. A feature run
        records the stopping point on SeerAgentRun.extras while a legacy run has it
        in Seer's run state; for each stopping point both must continue to the same
        step, or both must stop."""
        expected_next_step = {
            AutofixStoppingPoint.ROOT_CAUSE: None,
            AutofixStoppingPoint.SOLUTION: AutofixStep.SOLUTION,
            AutofixStoppingPoint.CODE_CHANGES: AutofixStep.SOLUTION,
        }

        for i, (stopping_point, expected_step) in enumerate(expected_next_step.items()):
            # seer_run_state_id is unique per run, so vary it across iterations.
            run_state_id = 700 + i

            # New flow: stopping point read off the run mirror, absent from state.
            agent_run = self._create_agent_run(
                seer_run_state_id=run_state_id, stopping_point=stopping_point
            )
            mock_fetch.return_value = self._run_state(run_id=run_state_id)
            mock_trigger.reset_mock()

            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=agent_run.run.uuid,
                status="completed",
                result=VALID_RESULT,
                error=None,
            )

            feature_step = mock_trigger.call_args.kwargs["step"] if mock_trigger.called else None

            # Old flow: same stopping point, carried in Seer's run state instead.
            legacy_state = self._run_state(run_id=run_state_id)
            legacy_state.metadata = {
                "group_id": self.group.id,
                "stopping_point": stopping_point.value,
            }
            mock_trigger.reset_mock()

            AutofixOnCompletionHook._maybe_continue_pipeline(
                self.organization, run_state_id, legacy_state, self.group
            )

            legacy_step = mock_trigger.call_args.kwargs["step"] if mock_trigger.called else None

            assert feature_step == expected_step, f"feature flow diverged for {stopping_point}"
            assert legacy_step == expected_step, f"legacy flow diverged for {stopping_point}"

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
