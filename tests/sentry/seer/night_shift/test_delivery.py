from typing import Any
from unittest.mock import Mock, patch
from uuid import UUID

from sentry.api.serializers import EventSerializer
from sentry.issues.action_log.types import SYSTEM_ACTOR, ActionSource, TriggerAutofixAction
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models.autofix_issue_data import SeerAutofixIssueData
from sentry.seer.models.night_shift import SeerNightShiftRunErrorType, SeerNightShiftRunResult
from sentry.seer.models.run import SeerRun
from sentry.seer.models.workflow import SeerWorkflowRun, SeerWorkflowRunExecution
from sentry.seer.night_shift.delivery import (
    REASON_MAX_CHARS,
    _get_serialized_event,
    deliver_night_shift_result,
)
from sentry.tasks.seer.night_shift.models import TriageAction
from sentry.tasks.seer.night_shift.skip_cache import key as skip_cache_key
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.action_log import capture_action_log
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.activity import ActivityType
from sentry.utils.redis import redis_clusters


@django_db_all
class TestDeliverNightShiftResult(TestCase):
    def _create_night_shift_run(
        self, organization: Organization | None = None, **extras_overrides: Any
    ) -> SeerWorkflowRun:
        """Create a sharded SeerWorkflowRun: one shard owning a SeerRun and no
        legacy scalar seer_run (the steady state after migration)."""
        org = organization or self.create_organization()
        extras = {"options": {}, **extras_overrides}
        run = SeerWorkflowRun.objects.create(organization=org, extras=extras)
        SeerWorkflowRunExecution.objects.create(
            run=run, seer_run=self.create_seer_run(organization=org)
        )
        return run

    def _run_uuid(self, run: SeerWorkflowRun) -> UUID:
        seer_run = run.executions.get().seer_run
        assert seer_run is not None
        return seer_run.uuid

    def _triggered_run(self, seer_run_state_id: int, organization: Organization) -> SeerRun:
        return self.create_seer_run(organization=organization, seer_run_state_id=seer_run_state_id)

    def _deliver_dry_run_verdict(
        self, organization: Organization, group_id: int, reason: str = ""
    ) -> SeerWorkflowRun:
        run = self._create_night_shift_run(organization=organization, options={"dry_run": True})
        deliver_night_shift_result(
            organization_id=organization.id,
            run_uuid=self._run_uuid(run),
            status="completed",
            result={
                "verdicts": [
                    {
                        "group_id": group_id,
                        "action": TriageAction.AUTOFIX.value,
                        "reason": reason,
                    }
                ]
            },
            error=None,
        )
        return run

    def test_missing_run_logs_warning(self) -> None:
        """When run_uuid doesn't match any SeerWorkflowRun, log and return."""
        org = self.create_organization()

        with patch("sentry.seer.night_shift.delivery.logger") as mock_logger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=UUID("00000000-0000-0000-0000-000000000000"),
                status="completed",
                result={"verdicts": []},
                error=None,
            )

            mock_logger.warning.assert_called_once()
            assert "night_shift.delivery.missing_run" in mock_logger.warning.call_args.args[0]

    def test_error_status_records_error_and_returns(self) -> None:
        """When status is 'error', record the error on the shard and return early."""
        run = self._create_night_shift_run()

        with patch("sentry.seer.night_shift.delivery.logger") as mock_logger:
            deliver_night_shift_result(
                organization_id=run.organization_id,
                run_uuid=self._run_uuid(run),
                status="error",
                result=None,
                error="Seer exploded",
            )

            mock_logger.warning.assert_called()
            assert "night_shift.delivery.no_result" in mock_logger.warning.call_args.args[0]

        shard = run.executions.get()
        assert shard.extras["error_message"] == "Seer exploded"
        assert shard.extras["error_type"] == SeerNightShiftRunErrorType.SHARD_DELIVERY_FAILED.value
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_schedules_judging_after_final_shard_delivery(self) -> None:
        org = self.create_organization()
        run = self._create_night_shift_run(organization=org)
        first_shard = run.executions.get()
        assert first_shard.seer_run is not None
        second_seer_run = self.create_seer_run(organization=org)
        SeerWorkflowRunExecution.objects.create(run=run, seer_run=second_seer_run)

        with (
            self.feature("organizations:seer-fixability-training-data"),
            patch(
                "sentry.seer.night_shift.delivery.schedule_judging_for_org.apply_async"
            ) as mock_schedule,
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=first_shard.seer_run.uuid,
                status="error",
                result=None,
                error="Seer exploded",
            )
            mock_schedule.assert_not_called()

            for _ in range(2):
                deliver_night_shift_result(
                    organization_id=org.id,
                    run_uuid=second_seer_run.uuid,
                    status="completed",
                    result={"verdicts": []},
                    error=None,
                )

            mock_schedule.assert_called_once_with(
                args=[org.id], headers={"sentry-propagate-traces": False}
            )

    def test_sibling_shard_success_keeps_other_shard_error(self) -> None:
        """A successful shard delivery must not clear an error a sibling shard
        recorded on the same run."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = SeerWorkflowRun.objects.create(organization=org, extras={"options": {}})
        failed_seer_run = self.create_seer_run(organization=org)
        ok_seer_run = self.create_seer_run(organization=org)
        failed_shard = SeerWorkflowRunExecution.objects.create(run=run, seer_run=failed_seer_run)
        SeerWorkflowRunExecution.objects.create(run=run, seer_run=ok_seer_run)

        deliver_night_shift_result(
            organization_id=org.id,
            run_uuid=failed_seer_run.uuid,
            status="error",
            result=None,
            error="shard failed",
        )
        with patch(
            "sentry.seer.night_shift.delivery.trigger_autofix_agent",
            return_value=self._triggered_run(1, org),
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=ok_seer_run.uuid,
                status="completed",
                result={
                    "verdicts": [
                        {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "ok"}
                    ]
                },
                error=None,
            )

        failed_shard.refresh_from_db()
        assert failed_shard.extras["error_message"] == "shard failed"
        assert (
            failed_shard.extras["error_type"]
            == SeerNightShiftRunErrorType.SHARD_DELIVERY_FAILED.value
        )

    def test_invalid_result_logs_exception(self) -> None:
        """When result can't be parsed as TriageResponse, log and return."""
        run = self._create_night_shift_run()

        with patch("sentry.seer.night_shift.delivery.logger") as mock_logger:
            deliver_night_shift_result(
                organization_id=run.organization_id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result={"invalid": "schema"},
                error=None,
            )

            mock_logger.exception.assert_called_once()
            assert "night_shift.delivery.invalid_result" in mock_logger.exception.call_args.args[0]

        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_get_serialized_event_falls_back_and_strips_meta(self) -> None:
        group = self.create_group()
        event = Mock(event_id="a" * 32)
        ready_event = Mock()
        with (
            patch.object(group, "get_recommended_event_for_environments", return_value=None),
            patch.object(group, "get_latest_event", return_value=event),
            patch(
                "sentry.seer.night_shift.delivery.eventstore.get_event_by_id",
                return_value=ready_event,
            ),
            patch(
                "sentry.seer.night_shift.delivery.serialize",
                return_value={"eventID": event.event_id, "entries": [], "_meta": {}},
            ) as mock_serialize,
        ):
            result = _get_serialized_event(group)

        assert result == (event.event_id, {"eventID": event.event_id, "entries": []})
        assert isinstance(mock_serialize.call_args.args[2], EventSerializer)

    def test_autofix_issue_data_captured_when_enabled(self) -> None:
        org = self.create_organization()
        group = self.create_group(project=self.create_project(organization=org))
        event = {"eventID": "a" * 32, "entries": [{"type": "exception"}]}
        with (
            self.feature("organizations:seer-fixability-training-data"),
            patch(
                "sentry.seer.night_shift.delivery._get_serialized_event",
                return_value=(event["eventID"], event),
            ),
        ):
            self._deliver_dry_run_verdict(org, group.id, "fixable")

        row = SeerAutofixIssueData.objects.get(group=group)
        assert row.organization_id == org.id
        assert row.project_id == group.project_id
        assert row.source == "night_shift"
        assert set(row.raw_issue_data) == {"status", "reason", "event_id", "event", "issue"}
        assert row.raw_issue_data["status"] == "autofix"
        assert row.raw_issue_data["reason"] == "fixable"
        assert row.raw_issue_data["event_id"] == event["eventID"]
        assert row.raw_issue_data["event"] == event
        assert set(row.raw_issue_data["issue"]) == {
            "title",
            "culprit",
            "platform",
            "type",
            "message",
            "first_seen",
            "last_seen",
            "times_seen",
            "logger",
            "data",
        }

    def test_autofix_issue_data_feature_flag_gates_capture(self) -> None:
        org = self.create_organization()
        group = self.create_group(project=self.create_project(organization=org))
        with (
            patch("sentry.seer.night_shift.delivery.features.has", return_value=False),
            patch("sentry.seer.night_shift.delivery._capture_autofix_issue_data") as capture,
        ):
            run = self._deliver_dry_run_verdict(org, group.id)

        capture.assert_not_called()
        assert SeerNightShiftRunResult.objects.filter(run=run, group=group).exists()
        assert not SeerAutofixIssueData.objects.filter(group=group).exists()

    def test_autofix_issue_data_failure_does_not_block_delivery(self) -> None:
        org = self.create_organization()
        group = self.create_group(project=self.create_project(organization=org))
        with (
            self.feature("organizations:seer-fixability-training-data"),
            patch(
                "sentry.seer.night_shift.delivery._capture_autofix_issue_data",
                side_effect=RuntimeError,
            ),
        ):
            run = self._deliver_dry_run_verdict(org, group.id)

        assert SeerNightShiftRunResult.objects.filter(run=run, group=group).exists()

    def test_autofix_issue_data_reprocessing_updates_row(self) -> None:
        org = self.create_organization()
        group = self.create_group(project=self.create_project(organization=org))
        with (
            self.feature("organizations:seer-fixability-training-data"),
            patch(
                "sentry.seer.night_shift.delivery._get_serialized_event",
                side_effect=[("a" * 32, {}), ("b" * 32, {})],
            ),
        ):
            self._deliver_dry_run_verdict(org, group.id, "first")
            row_id = SeerAutofixIssueData.objects.get(group=group).id
            self._deliver_dry_run_verdict(org, group.id, "second")

        row = SeerAutofixIssueData.objects.get(group=group)
        assert row.id == row_id
        assert row.raw_issue_data["event_id"] == "b" * 32
        assert row.raw_issue_data["reason"] == "second"

    def test_skip_verdict_marks_group_skipped(self) -> None:
        """SKIP verdicts mark the group in the skip cache and persist a result
        row without a seer run."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.SKIP.value, "reason": "not fixable"}
            ]
        }

        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent") as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            mock_trigger.assert_not_called()

        # Verify skip cache was set
        redis = redis_clusters.get("default")
        try:
            assert redis.exists(skip_cache_key(group.id))
        finally:
            redis.delete(skip_cache_key(group.id))

        skip_result = SeerNightShiftRunResult.objects.get(run=run)
        assert skip_result.group_id == group.id
        assert skip_result.seer_run_id is None
        assert skip_result.result_seer_run is None
        assert skip_result.extras["action"] == TriageAction.SKIP.value
        assert skip_result.extras["reason"] == "not fixable"
        assert "trigger_error" not in skip_result.extras

    def test_autofix_verdict_triggers_autofix(self) -> None:
        """AUTOFIX verdicts should trigger autofix with project stopping point."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        project.update_option(
            "sentry:seer_automated_run_stopping_point", AutofixStoppingPoint.OPEN_PR.value
        )
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "looks good"}
            ]
        }

        with patch(
            "sentry.seer.night_shift.delivery.trigger_autofix_agent",
            return_value=self._triggered_run(42, org),
        ) as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            mock_trigger.assert_called_once()
            assert mock_trigger.call_args.kwargs["group"].id == group.id
            assert mock_trigger.call_args.kwargs["stopping_point"] == AutofixStoppingPoint.OPEN_PR

        results = list(SeerNightShiftRunResult.objects.filter(run=run))
        assert len(results) == 1
        assert results[0].group_id == group.id
        assert results[0].seer_run_id == "42"
        assert results[0].extras["action"] == TriageAction.AUTOFIX.value
        assert results[0].extras["reason"] == "looks good"

    def test_autofix_verdict_creates_system_activity(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)
        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "fixable"}
            ]
        }

        with (
            patch(
                "sentry.seer.night_shift.delivery.trigger_autofix_agent",
                return_value=self._triggered_run(42, org),
            ),
            capture_action_log() as action_log,
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

        activity = Activity.objects.get(group=group, type=ActivityType.TRIGGER_AUTOFIX.value)
        assert activity.user_id is None
        assert activity.data == {"referrer": "night_shift"}
        action_log.assert_logged(
            TriggerAutofixAction,
            group_id=group.id,
            source=ActionSource.SYSTEM,
            actor=SYSTEM_ACTOR,
            referrer="night_shift",
        )

    def test_root_cause_only_verdict_marks_group_skipped(self) -> None:
        """ROOT_CAUSE_ONLY verdicts are treated like SKIP: marked in the skip
        cache and never triggering autofix, while keeping the distinct action."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {
                    "group_id": group.id,
                    "action": TriageAction.ROOT_CAUSE_ONLY.value,
                    "reason": "needs investigation",
                }
            ]
        }

        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent") as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            mock_trigger.assert_not_called()

        # Verify skip cache was set
        redis = redis_clusters.get("default")
        try:
            assert redis.exists(skip_cache_key(group.id))
        finally:
            redis.delete(skip_cache_key(group.id))

        result_row = SeerNightShiftRunResult.objects.get(run=run)
        assert result_row.group_id == group.id
        assert result_row.seer_run_id is None
        assert result_row.extras["action"] == TriageAction.ROOT_CAUSE_ONLY.value

    def test_skip_verdict_persists_skip_reason(self) -> None:
        """A SKIP verdict's skip_reason is persisted into the result row's extras."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {
                    "group_id": group.id,
                    "action": TriageAction.SKIP.value,
                    "reason": "flaky test suspected",
                    "skip_reason": "ambiguous_root_cause",
                }
            ]
        }

        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent"):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

        redis = redis_clusters.get("default")
        redis.delete(skip_cache_key(group.id))

        result_row = SeerNightShiftRunResult.objects.get(run=run)
        assert result_row.extras["skip_reason"] == "ambiguous_root_cause"

    def test_root_cause_only_verdict_does_not_persist_skip_reason(self) -> None:
        """skip_reason is only meaningful for SKIP verdicts; a ROOT_CAUSE_ONLY
        verdict must not carry one into extras even if Seer sent one."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {
                    "group_id": group.id,
                    "action": TriageAction.ROOT_CAUSE_ONLY.value,
                    "reason": "needs investigation",
                    "skip_reason": "ambiguous_root_cause",
                }
            ]
        }

        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent"):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

        redis = redis_clusters.get("default")
        redis.delete(skip_cache_key(group.id))

        result_row = SeerNightShiftRunResult.objects.get(run=run)
        assert "skip_reason" not in result_row.extras

    def test_unrecognized_skip_reason_does_not_fail_delivery(self) -> None:
        """skip_reason is a passthrough string, not a mirrored enum: a category
        Seer added that this code doesn't know about yet must still parse and
        persist, not fail the whole batch. See TriageVerdict.skip_reason."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {
                    "group_id": group.id,
                    "action": TriageAction.SKIP.value,
                    "reason": "test appears flaky",
                    "skip_reason": "flaky_test",
                }
            ]
        }

        with patch("sentry.seer.night_shift.delivery.logger") as mock_logger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            mock_logger.exception.assert_not_called()

        redis = redis_clusters.get("default")
        redis.delete(skip_cache_key(group.id))

        result_row = SeerNightShiftRunResult.objects.get(run=run)
        assert result_row.extras["skip_reason"] == "flaky_test"

    def test_dry_run_skips_autofix(self) -> None:
        """Dry run mode should not trigger autofix but still persist verdict rows."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org, options={"dry_run": True})

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "fixable"}
            ]
        }

        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent") as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            mock_trigger.assert_not_called()

        result_row = SeerNightShiftRunResult.objects.get(run=run)
        assert result_row.group_id == group.id
        assert result_row.seer_run_id is None
        assert result_row.extras["action"] == TriageAction.AUTOFIX.value
        # An untriggered dry-run verdict is not a trigger failure.
        assert "trigger_error" not in result_row.extras

    def test_trigger_failure_continues_with_other_groups(self) -> None:
        """If trigger fails for one group, continue processing others."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        failing_group = self.create_group(project=project)
        ok_group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {
                    "group_id": failing_group.id,
                    "action": TriageAction.AUTOFIX.value,
                    "reason": "will fail",
                },
                {
                    "group_id": ok_group.id,
                    "action": TriageAction.AUTOFIX.value,
                    "reason": "will work",
                },
            ]
        }

        ok_run = self._triggered_run(7, org)

        def trigger_side_effect(**kwargs: Any) -> SeerRun:
            if kwargs["group"].id == failing_group.id:
                raise RuntimeError("trigger failed")
            return ok_run

        with (
            patch(
                "sentry.seer.night_shift.delivery.trigger_autofix_agent",
                side_effect=trigger_side_effect,
            ),
            patch("sentry.seer.night_shift.delivery.logger") as mock_logger,
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            exception_calls = [call.args[0] for call in mock_logger.exception.call_args_list]
            assert "night_shift.autofix_trigger_failed" in exception_calls

        results = {r.group_id: r for r in SeerNightShiftRunResult.objects.filter(run=run)}
        assert set(results) == {failing_group.id, ok_group.id}
        assert results[ok_group.id].seer_run_id == "7"
        assert "trigger_error" not in results[ok_group.id].extras
        assert results[failing_group.id].seer_run_id is None
        assert results[failing_group.id].extras["action"] == TriageAction.AUTOFIX.value
        assert results[failing_group.id].extras["trigger_error"] is True

    def test_rate_limited_group_skips_trigger_and_continues_with_others(self) -> None:
        """A group whose project is at the autotriggered-autofix rate limit
        should not have autofix triggered, but other groups in the same
        delivery should still go through."""
        org = self.create_organization()
        limited_project = self.create_project(organization=org, slug="limited")
        ok_project = self.create_project(organization=org, slug="ok")
        limited_group = self.create_group(project=limited_project)
        ok_group = self.create_group(project=ok_project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {
                    "group_id": limited_group.id,
                    "action": TriageAction.AUTOFIX.value,
                    "reason": "rate limited",
                },
                {
                    "group_id": ok_group.id,
                    "action": TriageAction.AUTOFIX.value,
                    "reason": "will work",
                },
            ]
        }

        def rate_limited_side_effect(project: Project, organization: Organization) -> bool:
            return project.id == limited_group.project_id

        with (
            patch(
                "sentry.seer.night_shift.delivery.is_seer_autotriggered_autofix_rate_limited_and_increment",
                side_effect=rate_limited_side_effect,
            ),
            patch(
                "sentry.seer.night_shift.delivery.trigger_autofix_agent",
                return_value=self._triggered_run(7, org),
            ) as mock_trigger,
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

        mock_trigger.assert_called_once()
        assert mock_trigger.call_args.kwargs["group"].id == ok_group.id

        results = {r.group_id: r for r in SeerNightShiftRunResult.objects.filter(run=run)}
        assert set(results) == {limited_group.id, ok_group.id}
        assert results[ok_group.id].seer_run_id == "7"
        assert results[limited_group.id].seer_run_id is None
        assert results[limited_group.id].extras["action"] == TriageAction.AUTOFIX.value
        assert results[limited_group.id].extras["rate_limited"] is True
        assert "trigger_error" not in results[limited_group.id].extras

    def test_seat_based_orgs_skip_the_rate_limit_check(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "ok"}
            ]
        }

        with (
            patch(
                "sentry.seer.night_shift.delivery.is_seer_autotriggered_autofix_rate_limited_and_increment",
                return_value=True,
            ) as mock_rate_limited,
            patch(
                "sentry.seer.night_shift.delivery.is_seer_seat_based_tier_enabled",
                return_value=True,
            ),
            patch(
                "sentry.seer.night_shift.delivery.trigger_autofix_agent",
                return_value=self._triggered_run(1, org),
            ) as mock_trigger,
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

        mock_rate_limited.assert_not_called()
        mock_trigger.assert_called_once()

        result_row = SeerNightShiftRunResult.objects.get(run=run)
        assert result_row.seer_run_id == "1"
        assert "rate_limited" not in result_row.extras

    def test_unknown_group_ids_logged(self) -> None:
        """Groups not belonging to the org should be logged and skipped."""
        org = self.create_organization()
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_group = self.create_group(project=other_project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {
                    "group_id": other_group.id,
                    "action": TriageAction.AUTOFIX.value,
                    "reason": "wrong org",
                }
            ]
        }

        with (
            patch("sentry.seer.night_shift.delivery.trigger_autofix_agent") as mock_trigger,
            patch("sentry.seer.night_shift.delivery.logger") as mock_logger,
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            mock_trigger.assert_not_called()
            warning_calls = [call.args[0] for call in mock_logger.warning.call_args_list]
            assert "night_shift.delivery.unknown_group_ids" in warning_calls

        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_user_context_passed_to_autofix(self) -> None:
        """Verdict reason should be passed as user_context to autofix."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {
                    "group_id": group.id,
                    "action": TriageAction.AUTOFIX.value,
                    "reason": "This issue is caused by a null pointer",
                }
            ]
        }

        with patch(
            "sentry.seer.night_shift.delivery.trigger_autofix_agent",
            return_value=self._triggered_run(1, org),
        ) as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            user_context = mock_trigger.call_args.kwargs["user_context"]
            assert "This issue is caused by a null pointer" in user_context

    def test_successful_delivery_clears_stale_error_message(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)
        shard = run.executions.get()
        shard.update(
            extras={
                "error_type": SeerNightShiftRunErrorType.SHARD_DELIVERY_FAILED.value,
                "error_message": "Night shift run failed",
            }
        )

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "fixable"}
            ]
        }

        with patch(
            "sentry.seer.night_shift.delivery.trigger_autofix_agent",
            return_value=self._triggered_run(1, org),
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

        shard.refresh_from_db()
        assert "error_message" not in shard.extras
        assert "error_type" not in shard.extras

    def test_redelivery_is_idempotent(self) -> None:
        """Redelivering the same shard result must not re-trigger autofix or
        create duplicate rows."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "fixable"}
            ]
        }

        with patch(
            "sentry.seer.night_shift.delivery.trigger_autofix_agent",
            return_value=self._triggered_run(11, org),
        ) as mock_trigger:
            for _ in range(2):
                deliver_night_shift_result(
                    organization_id=org.id,
                    run_uuid=self._run_uuid(run),
                    status="completed",
                    result=result,
                    error=None,
                )

            mock_trigger.assert_called_once()

        assert SeerNightShiftRunResult.objects.filter(run=run).count() == 1

    def test_redelivery_of_pre_idempotency_key_row_is_idempotent(self) -> None:
        """A result row written before idempotency_key existed (null key, group_id
        still set) must still block redelivery."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        SeerNightShiftRunResult.objects.create(
            run=run,
            kind="agentic_triage",
            group=group,
            idempotency_key=None,
            extras={"action": TriageAction.AUTOFIX.value},
        )

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "fixable"}
            ]
        }

        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent") as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            mock_trigger.assert_not_called()

        assert SeerNightShiftRunResult.objects.filter(run=run).count() == 1

    def test_result_links_seer_run(self) -> None:
        """When the SeerRun mirror row exists, the result row links it."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)
        autofix_seer_run = self.create_seer_run(organization=org, seer_run_state_id=99)

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "fixable"}
            ]
        }

        with patch(
            "sentry.seer.night_shift.delivery.trigger_autofix_agent",
            return_value=autofix_seer_run,
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

        result_row = SeerNightShiftRunResult.objects.get(run=run)
        assert result_row.seer_run_id == "99"
        assert result_row.result_seer_run_id == autofix_seer_run.id

    def test_reason_truncated(self) -> None:
        """Persisted reasons are capped at REASON_MAX_CHARS."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {
                    "group_id": group.id,
                    "action": TriageAction.SKIP.value,
                    "reason": "x" * (REASON_MAX_CHARS + 100),
                }
            ]
        }

        deliver_night_shift_result(
            organization_id=org.id,
            run_uuid=self._run_uuid(run),
            status="completed",
            result=result,
            error=None,
        )

        result_row = SeerNightShiftRunResult.objects.get(run=run)
        assert result_row.extras["reason"] == "x" * REASON_MAX_CHARS

        redis = redis_clusters.get("default")
        redis.delete(skip_cache_key(group.id))

    def test_empty_reason_no_user_context(self) -> None:
        """Empty reason should result in no user_context."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [{"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": ""}]
        }

        with patch(
            "sentry.seer.night_shift.delivery.trigger_autofix_agent",
            return_value=self._triggered_run(1, org),
        ) as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            assert mock_trigger.call_args.kwargs["user_context"] is None

    def test_prompt_version_recorded_on_shard_and_result_rows(self) -> None:
        """prompt_version is recorded on the shard and denormalized onto every verdict row."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.SKIP.value, "reason": "not fixable"}
            ]
        }

        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent"):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
                prompt_version="2026-09-02.1",
            )

        redis = redis_clusters.get("default")
        redis.delete(skip_cache_key(group.id))

        shard = run.executions.get()
        assert shard.extras["prompt_version"] == "2026-09-02.1"
        result_row = SeerNightShiftRunResult.objects.get(run=run)
        assert result_row.extras["prompt_version"] == "2026-09-02.1"

    def test_prompt_version_recorded_on_error_delivery(self) -> None:
        """Errored deliveries write no verdict rows, so prompt_version lands only on the shard."""
        run = self._create_night_shift_run()

        deliver_night_shift_result(
            organization_id=run.organization_id,
            run_uuid=self._run_uuid(run),
            status="error",
            result=None,
            error="Seer exploded",
            prompt_version="2026-09-02.1",
        )

        shard = run.executions.get()
        assert shard.extras["prompt_version"] == "2026-09-02.1"
        assert shard.extras["error_message"] == "Seer exploded"
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_absent_prompt_version_leaves_extras_clean(self) -> None:
        """Deliveries without a prompt_version (older Seer) must not write the key."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.SKIP.value, "reason": "not fixable"}
            ]
        }

        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent"):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

        redis = redis_clusters.get("default")
        redis.delete(skip_cache_key(group.id))

        shard = run.executions.get()
        assert "prompt_version" not in shard.extras
        result_row = SeerNightShiftRunResult.objects.get(run=run)
        assert "prompt_version" not in result_row.extras
