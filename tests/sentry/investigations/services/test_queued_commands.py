from __future__ import annotations

from contextlib import AbstractContextManager, nullcontext
from typing import Any
from unittest import mock
from uuid import uuid4

from django.test import override_settings

from sentry.investigations.models import (
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationRerun,
)
from sentry.investigations.services.orchestration import accept_orchestration_command
from sentry.investigations.services.orchestration_events import (
    deliver_orchestration_event,
    synchronize_orchestration_projection,
)
from sentry.seer.models.run import SeerRunMirrorStatus, SeerRunType
from sentry.tasks.seer.investigation import (
    _mark_command_dispatch_failed,
    _mark_command_version_conflicted,
    dispatch_investigation_orchestration_commands,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json
from sentry.viewer_context import (
    Actor,
    ActorType,
    ViewerContext,
    decode_viewer_context,
    viewer_context_scope,
)
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

    def rerun(self) -> InvestigationOrchestrationCommand:
        payload = fixture("command_rerun_after_connection")
        del payload["type"]
        return self.accept("rerun_after_connection", payload)

    def assert_a_turned_down_re_run_keeps_seers_code(
        self, seer: mock.Mock, code: str, *, fixture_name: str | None = None
    ) -> None:
        self.seer_rejects_with(seer, fixture_name or f"rejected_rerun_after_connection_{code}")
        rerun = self.rerun()

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        rerun.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert rerun.status == InvestigationOrchestrationCommandStatus.FAILED
        assert rerun.error is not None
        assert rerun.error["reason"] == code
        assert self.orchestration_run.error is None

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_re_run_turned_down_because_the_run_was_cancelled(self, seer: mock.Mock) -> None:
        self.assert_a_turned_down_re_run_keeps_seers_code(seer, "run_cancelled")

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_re_run_turned_down_because_the_run_failed(self, seer: mock.Mock) -> None:
        self.assert_a_turned_down_re_run_keeps_seers_code(seer, "run_failed")

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_re_run_turned_down_because_the_provider_is_not_connected(
        self, seer: mock.Mock
    ) -> None:
        self.assert_a_turned_down_re_run_keeps_seers_code(seer, "provider_not_connected")

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_re_run_turned_down_because_the_provider_was_used(self, seer: mock.Mock) -> None:
        self.assert_a_turned_down_re_run_keeps_seers_code(seer, "provider_already_used")

    def seer_accepts_with(self, seer: mock.Mock, name: str) -> None:
        """Seer accepts every command and answers with this fixture."""

        self.orchestration_run.update(
            seer_run=self.create_seer_run(
                organization=self.organization,
                type=SeerRunType.INVESTIGATION,
                seer_run_state_id=self.seer_run_id,
                mirror_status=SeerRunMirrorStatus.LIVE,
            )
        )

        def respond(_pool: object, path: str, *, body: bytes, **_: object) -> mock.Mock:
            accepted = {
                "runId": self.seer_run_id,
                "requestId": json.loads(body)["requestId"],
                "accepted": True,
                "duplicate": False,
                "workflowVersion": 11,
                "projection": self.projection(),
                **fixture(name),
            }
            return mock.Mock(status=200, data=json.dumps(accepted).encode())

        seer.side_effect = respond

    def held_rerun(self, seer: mock.Mock) -> InvestigationOrchestrationCommand:
        self.seer_accepts_with(seer, "rerun_after_connection_held")
        rerun = self.rerun()
        dispatch_investigation_orchestration_commands(self.orchestration_run.id)
        rerun.refresh_from_db()
        return rerun

    def seer_sends_rerun_updated(
        self, rerun: InvestigationOrchestrationCommand, name: str, *, generation: int = 1
    ) -> None:
        self.orchestration_run.refresh_from_db()
        deliver_orchestration_event(
            organization_id=self.organization.id,
            event={
                "schema_version": 1,
                "event_id": uuid4(),
                "run_id": self.seer_run_id,
                "investigation_id": self.investigation.id,
                "sequence": self.orchestration_run.last_event_sequence + 1,
                "generation": generation,
                "type": "rerun_updated",
                "payload": {**fixture(name), "requestId": str(rerun.request_id)},
            },
        )

    def run_becomes(self, status: str) -> None:
        synchronize_orchestration_projection(
            orchestration_run_id=self.orchestration_run.id,
            seer_run_id=self.seer_run_id,
            projection={**self.projection(), "workflowVersion": 11, "status": status},
        )

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_re_run_seer_started_is_stored_as_started(self, seer: mock.Mock) -> None:
        self.seer_accepts_with(seer, "rerun_after_connection_started")
        rerun = self.rerun()

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        rerun.refresh_from_db()
        assert rerun.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert rerun.rerun == InvestigationOrchestrationRerun.STARTED

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_re_run_seer_held_is_stored_as_held(self, seer: mock.Mock) -> None:
        rerun = self.held_rerun(seer)

        assert rerun.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert rerun.rerun == InvestigationOrchestrationRerun.HELD

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_the_run_ending_leaves_a_held_re_run_to_seer(self, seer: mock.Mock) -> None:
        rerun = self.held_rerun(seer)
        self.run_becomes("processing")

        self.run_becomes("failed")

        rerun.refresh_from_db()
        assert rerun.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert rerun.rerun == InvestigationOrchestrationRerun.HELD

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_held_re_run_seer_starts_in_its_new_generation(self, seer: mock.Mock) -> None:
        rerun = self.held_rerun(seer)

        self.seer_sends_rerun_updated(rerun, "rerun_updated_started", generation=2)

        rerun.refresh_from_db()
        assert rerun.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert rerun.rerun == InvestigationOrchestrationRerun.STARTED

    def assert_a_dropped_re_run_fails_with_seers_reason(self, seer: mock.Mock, reason: str) -> None:
        rerun = self.held_rerun(seer)

        self.seer_sends_rerun_updated(rerun, f"rerun_updated_skipped_{reason}")

        rerun.refresh_from_db()
        assert rerun.status == InvestigationOrchestrationCommandStatus.FAILED
        assert rerun.rerun == InvestigationOrchestrationRerun.SKIPPED
        assert rerun.error == {"code": "rerun_skipped", "reason": reason}

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_held_re_run_dropped_because_the_run_failed(self, seer: mock.Mock) -> None:
        self.assert_a_dropped_re_run_fails_with_seers_reason(seer, "run_failed")

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_held_re_run_dropped_because_the_run_was_cancelled(self, seer: mock.Mock) -> None:
        self.assert_a_dropped_re_run_fails_with_seers_reason(seer, "run_cancelled")

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_held_re_run_dropped_because_the_provider_disconnected(self, seer: mock.Mock) -> None:
        self.assert_a_dropped_re_run_fails_with_seers_reason(seer, "provider_not_connected")

    def seer_settles_it_before_answering(self, seer: mock.Mock, name: str) -> None:
        """Seer holds the re-run, and its rerun_updated event lands before its response."""

        self.seer_accepts_with(seer, "rerun_after_connection_held")
        answer = seer.side_effect

        def respond(pool: object, path: str, *, body: bytes, **kwargs: object) -> mock.Mock:
            command = InvestigationOrchestrationCommand.objects.get(
                request_id=json.loads(body)["requestId"]
            )
            self.seer_sends_rerun_updated(command, name)
            return answer(pool, path, body=body, **kwargs)

        seer.side_effect = respond

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_start_that_lands_before_the_response_is_kept(self, seer: mock.Mock) -> None:
        self.seer_settles_it_before_answering(seer, "rerun_updated_started")
        rerun = self.rerun()

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        rerun.refresh_from_db()
        assert rerun.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert rerun.rerun == InvestigationOrchestrationRerun.STARTED

    def test_a_re_run_update_settles_it_in_any_order(self) -> None:
        rejected = {"code": "seer_command_rejected", "reason": "run_failed", "retryable": False}
        settled = {
            "started": (
                InvestigationOrchestrationCommandStatus.ACKNOWLEDGED,
                None,
                InvestigationOrchestrationRerun.STARTED,
            ),
            "skipped": (
                InvestigationOrchestrationCommandStatus.FAILED,
                {"code": "rerun_skipped", "reason": "run_failed"},
                InvestigationOrchestrationRerun.SKIPPED,
            ),
        }
        # What happened to the command before Seer's update, and after it.
        orders = {
            "accepted": ("accepted", None),
            "dispatched": ("dispatched", None),
            "lost_response_first": ("lost_response", None),
            "rejected_first": ("rejected", None),
            "lost_response_after": ("dispatched", "lost_response"),
            "rejected_after": ("dispatched", "rejected"),
        }
        for order, (before, after) in orders.items():
            for outcome in ("started", "skipped"):
                with self.subTest(order=order, outcome=outcome):
                    rerun = self.rerun()
                    steer = self.steer()
                    self.dispatch.reset_mock()
                    with self.capture_on_commit_callbacks(execute=True):
                        if before == "dispatched":
                            rerun.update(status=InvestigationOrchestrationCommandStatus.DISPATCHED)
                        elif before == "lost_response":
                            _mark_command_dispatch_failed(rerun.id)
                        elif before == "rejected":
                            rerun.update(
                                status=InvestigationOrchestrationCommandStatus.FAILED,
                                error=rejected,
                            )
                        self.seer_sends_rerun_updated(
                            rerun,
                            "rerun_updated_started"
                            if outcome == "started"
                            else "rerun_updated_skipped_run_failed",
                        )
                    self.dispatch.assert_called_with(self.orchestration_run.id)
                    if after is not None:
                        self.dispatch.reset_mock()
                        with self.capture_on_commit_callbacks(execute=True):
                            if after == "lost_response":
                                _mark_command_dispatch_failed(rerun.id)
                            else:
                                _mark_command_version_conflicted(rerun.id, "run_failed")
                        self.dispatch.assert_called_with(self.orchestration_run.id)

                    rerun.refresh_from_db()
                    steer.refresh_from_db()
                    self.orchestration_run.refresh_from_db()
                    expected = (
                        (InvestigationOrchestrationCommandStatus.FAILED, rejected, None)
                        if before == "rejected"
                        else settled[outcome]
                    )
                    assert (rerun.status, rerun.error, rerun.rerun) == expected
                    assert (steer.status, steer.error) == (
                        InvestigationOrchestrationCommandStatus.ACCEPTED,
                        None,
                    )
                    assert self.orchestration_run.error is None
                    assert self.orchestration_run.projection["errors"] == []

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_drop_that_lands_before_the_response_is_kept(self, seer: mock.Mock) -> None:
        self.seer_settles_it_before_answering(seer, "rerun_updated_skipped_run_failed")
        rerun = self.rerun()

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        rerun.refresh_from_db()
        assert rerun.status == InvestigationOrchestrationCommandStatus.FAILED
        assert rerun.rerun == InvestigationOrchestrationRerun.SKIPPED
        assert rerun.error == {"code": "rerun_skipped", "reason": "run_failed"}

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_resent_re_run_seer_started_is_started(self, seer: mock.Mock) -> None:
        self.seer_accepts_with(seer, "duplicate_rerun_after_connection_started")
        rerun = self.rerun()

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        rerun.refresh_from_db()
        assert rerun.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert rerun.rerun == InvestigationOrchestrationRerun.STARTED

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_a_resent_re_run_seer_dropped_fails_with_its_reason(self, seer: mock.Mock) -> None:
        self.assert_a_turned_down_re_run_keeps_seers_code(
            seer, "run_failed", fixture_name="duplicate_rerun_after_connection_skipped"
        )

    @override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
    @mock.patch("sentry.investigations.seer_client.investigation_connection_pool.urlopen")
    def test_a_command_without_a_user_goes_out_as_sentry(self, urlopen: mock.Mock) -> None:
        self.orchestration_run.update(
            seer_run=self.create_seer_run(
                organization=self.organization,
                type=SeerRunType.INVESTIGATION,
                seer_run_state_id=self.seer_run_id,
                mirror_status=SeerRunMirrorStatus.LIVE,
            )
        )
        inherited: dict[str, AbstractContextManager[None]] = {
            "none": nullcontext(),
            "unknown": viewer_context_scope(ViewerContext(actor=Actor(type=ActorType.UNKNOWN))),
            "someone_else": viewer_context_scope(
                ViewerContext(
                    actor=Actor(type=ActorType.USER, actor_id=self.create_user().id),
                    organization_id=self.organization.id,
                )
            ),
        }
        for name, scope in inherited.items():
            with self.subTest(inherited=name):
                outcome = self.outcome()
                outcome.update(actor_id=None)
                urlopen.return_value = mock.Mock(
                    status=200,
                    data=json.dumps(
                        {
                            "runId": self.seer_run_id,
                            "requestId": str(outcome.request_id),
                            "accepted": True,
                            "duplicate": False,
                            "workflowVersion": 10,
                            "projection": self.projection(),
                        }
                    ).encode(),
                )

                with scope:
                    dispatch_investigation_orchestration_commands(self.orchestration_run.id)

                outcome.refresh_from_db()
                assert outcome.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
                viewer_context = decode_viewer_context(
                    urlopen.call_args.kwargs["headers"]["X-Viewer-Context"],
                    key="viewer-context-test-secret",
                )
                assert viewer_context.actor == Actor(type=ActorType.SYSTEM)
                assert viewer_context.organization_id == self.organization.id
