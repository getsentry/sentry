from __future__ import annotations

from typing import Any
from unittest import mock
from uuid import uuid4

from sentry.investigations.models import (
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
)
from sentry.investigations.services.orchestration import accept_orchestration_command
from sentry.seer.models.run import SeerRunMirrorStatus, SeerRunType
from sentry.tasks.seer.investigation import (
    _mark_command_dispatch_failed,
    dispatch_investigation_orchestration_commands,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json
from tests.sentry.investigations.test_seer_contract import fixture

OUTCOME = {
    "key": "k",
    "action": {"kind": "test_kind", "target": "a"},
    "reportRevision": 1,
    "outcome": "applied",
    "appliedBy": None,
}


class QueuedCommandsTest(TestCase):
    seer_run_id = 4815

    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            workflow_version=10,
            phase="completed",
            status="completed",
            projection=self.projection(),
        )
        dispatch = mock.patch(
            "sentry.tasks.seer.investigation.dispatch_investigation_orchestration_commands.delay"
        )
        self.dispatch = dispatch.start()
        self.addCleanup(dispatch.stop)

    def projection(self) -> dict[str, Any]:
        return {
            "runId": self.seer_run_id,
            "investigationId": str(self.investigation.id),
            "sourceType": "manual",
            "workflowVersion": 10,
            "generation": 1,
            "phase": "completed",
            "status": "completed",
            "broadScan": {"status": "completed"},
            "hypotheses": [],
            "report": {
                "revision": 1,
                "status": "completed",
                "notebookRevision": 0,
                "metadata": {"status": "completed"},
            },
            "pendingInput": None,
            "errors": [],
            "heartbeatAt": "2025-01-01T00:00:00+00:00",
        }

    def accept(
        self, command_type: str, payload: dict[str, Any]
    ) -> InvestigationOrchestrationCommand:
        self.orchestration_run.refresh_from_db()
        accepted = accept_orchestration_command(
            investigation=self.investigation,
            request_id=uuid4(),
            expected_workflow_version=self.orchestration_run.workflow_version,
            command_type=command_type,
            payload=payload,
            actor_id=self.user.id,
        )
        return InvestigationOrchestrationCommand.objects.get(request_id=accepted.request_id)

    def outcome(self) -> InvestigationOrchestrationCommand:
        return self.accept("record_action_outcome", OUTCOME)

    def steer(self) -> InvestigationOrchestrationCommand:
        return self.accept("steer", {"target": "workflow", "instruction": "Look again."})

    def test_outcomes_move_no_version(self) -> None:
        first = self.outcome()
        user = self.steer()
        second = self.outcome()

        assert (first.expected_workflow_version, first.resulting_workflow_version) == (10, 10)
        assert (user.expected_workflow_version, user.resulting_workflow_version) == (10, 11)
        assert (second.expected_workflow_version, second.resulting_workflow_version) == (11, 11)
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 11

    def test_a_resent_outcome_matches_after_the_version_moved(self) -> None:
        request_id = uuid4()
        for _ in range(2):
            accepted = accept_orchestration_command(
                investigation=self.investigation,
                request_id=request_id,
                expected_workflow_version=10,
                command_type="record_action_outcome",
                payload=OUTCOME,
                actor_id=self.user.id,
            )
            self.steer()

        assert accepted.duplicate

    def test_a_lost_outcome_leaves_the_queue_alone(self) -> None:
        first = self.outcome()
        user = self.steer()
        second = self.outcome()

        with self.capture_on_commit_callbacks(execute=True):
            _mark_command_dispatch_failed(first.id)

        for command in (user, second):
            command.refresh_from_db()
            assert command.status == InvestigationOrchestrationCommandStatus.ACCEPTED
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.error is None
        assert self.orchestration_run.projection["errors"] == []
        self.dispatch.assert_called_with(self.orchestration_run.id)

    def test_a_failed_user_command_does_not_take_outcomes_with_it(self) -> None:
        user = self.steer()
        later_user = self.steer()
        outcome = self.outcome()
        self.dispatch.reset_mock()

        with self.capture_on_commit_callbacks(execute=True):
            _mark_command_dispatch_failed(user.id)

        later_user.refresh_from_db()
        outcome.refresh_from_db()
        assert later_user.status == InvestigationOrchestrationCommandStatus.FAILED
        assert outcome.status == InvestigationOrchestrationCommandStatus.ACCEPTED
        self.dispatch.assert_called_once_with(self.orchestration_run.id)

    def seer_rejects_with(self, seer: mock.Mock, name: str) -> None:
        """Seer turns down every command with this fixture, and serves the run for the
        reconcile.
        """

        self.orchestration_run.update(
            seer_run=self.create_seer_run(
                organization=self.organization,
                type=SeerRunType.INVESTIGATION,
                seer_run_state_id=self.seer_run_id,
                mirror_status=SeerRunMirrorStatus.LIVE,
            )
        )
        run = {"runId": self.seer_run_id, "created": False, "projection": self.projection()}

        def respond(_pool: object, path: str, *, method: str = "POST", **_: object) -> mock.Mock:
            if method == "GET":
                return mock.Mock(status=200, data=json.dumps(run).encode())
            return mock.Mock(status=409, data=json.dumps(fixture(name)).encode())

        seer.side_effect = respond

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_an_outcome_seer_rejects_is_not_a_run_error(self, seer: mock.Mock) -> None:
        self.seer_rejects_with(seer, "rejected_record_action_outcome")
        outcome = self.outcome()
        user = self.steer()
        self.dispatch.reset_mock()

        with self.capture_on_commit_callbacks(execute=True):
            dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        outcome.refresh_from_db()
        user.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert outcome.status == InvestigationOrchestrationCommandStatus.FAILED
        assert outcome.error == {
            "code": "seer_command_rejected",
            "message": "Seer turned down this update.",
            "requestId": str(outcome.request_id),
            "commandType": "record_action_outcome",
            "reason": "invalid_command_target",
            "retryable": False,
        }
        assert user.status == InvestigationOrchestrationCommandStatus.ACCEPTED
        # Seer's run is still at 10, but the queued steer moves Sentry's to 11.
        assert self.orchestration_run.workflow_version == 11
        assert self.orchestration_run.error is None
        assert self.orchestration_run.projection["errors"] == []
        self.dispatch.assert_called_once_with(self.orchestration_run.id)

    def recheck(self) -> InvestigationOrchestrationCommand:
        return self.accept(
            "recheck_action_requests", {"reportRevision": 1, "source": {"type": "manual"}}
        )

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_re_check_seer_turns_down_keeps_seers_code(self, seer: mock.Mock) -> None:
        self.seer_rejects_with(seer, "rejected_recheck_action_requests")
        recheck = self.recheck()

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        recheck.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert recheck.status == InvestigationOrchestrationCommandStatus.FAILED
        assert recheck.error is not None
        assert recheck.error["reason"] == "action_requests_report_changed"
        # The re-check bumped Sentry's version, and Seer's never moved.
        assert self.orchestration_run.workflow_version == 10
        # The request shows it, so the run has no error.
        assert self.orchestration_run.error is None
        assert self.orchestration_run.projection["errors"] == []

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_turned_down_re_check_that_fails_a_user_command_is_a_run_error(
        self, seer: mock.Mock
    ) -> None:
        self.seer_rejects_with(seer, "rejected_recheck_action_requests")
        recheck = self.recheck()
        steer = self.steer()

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        recheck.refresh_from_db()
        steer.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert steer.status == InvestigationOrchestrationCommandStatus.FAILED
        assert steer.error is not None
        assert steer.error["code"] == "earlier_command_conflicted"
        assert self.orchestration_run.error == recheck.error
        assert self.orchestration_run.projection["errors"] == [recheck.error]

    def test_an_undelivered_re_check_that_fails_a_user_command_is_a_run_error(self) -> None:
        recheck = self.recheck()
        steer = self.steer()

        _mark_command_dispatch_failed(recheck.id)

        recheck.refresh_from_db()
        steer.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert steer.status == InvestigationOrchestrationCommandStatus.FAILED
        assert self.orchestration_run.error == recheck.error

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_user_command_seer_turns_down_is_a_run_error(self, seer: mock.Mock) -> None:
        self.seer_rejects_with(seer, "rejected_recheck_action_requests")
        steer = self.steer()

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        steer.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert steer.error is not None
        assert steer.error["reason"] == "action_requests_report_changed"
        assert self.orchestration_run.error == steer.error

    def test_an_undelivered_re_check_is_not_a_run_error(self) -> None:
        recheck = self.recheck()

        _mark_command_dispatch_failed(recheck.id)

        recheck.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert recheck.status == InvestigationOrchestrationCommandStatus.FAILED
        assert self.orchestration_run.error is None
        assert self.orchestration_run.projection["errors"] == []
