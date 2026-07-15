from typing import Any
from unittest.mock import patch

from sentry.models.organization import Organization
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunResult,
    SeerNightShiftRunShard,
)
from sentry.seer.night_shift.delivery import REASON_MAX_CHARS, deliver_night_shift_result
from sentry.tasks.seer.night_shift.models import TriageAction
from sentry.tasks.seer.night_shift.skip_cache import key as skip_cache_key
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.redis import redis_clusters


@django_db_all
class TestDeliverNightShiftResult(TestCase):
    def _create_night_shift_run(
        self, organization: Organization | None = None, **extras_overrides: Any
    ) -> SeerNightShiftRun:
        """Create a sharded SeerNightShiftRun: one shard owning a SeerRun and no
        legacy scalar seer_run (the steady state after migration)."""
        org = organization or self.create_organization()
        extras = {"options": {}, **extras_overrides}
        run = SeerNightShiftRun.objects.create(organization=org, extras=extras)
        SeerNightShiftRunShard.objects.create(
            run=run, seer_run=self.create_seer_run(organization=org)
        )
        return run

    def _run_uuid(self, run: SeerNightShiftRun) -> str:
        seer_run = run.shards.get().seer_run
        assert seer_run is not None
        return str(seer_run.uuid)

    def test_missing_run_logs_warning(self) -> None:
        """When run_uuid doesn't match any SeerNightShiftRun, log and return."""
        org = self.create_organization()

        with patch("sentry.seer.night_shift.delivery.logger") as mock_logger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid="00000000-0000-0000-0000-000000000000",
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

        shard = run.shards.get()
        assert shard.extras["error_message"] == "Seer exploded"
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_sibling_shard_success_keeps_other_shard_error(self) -> None:
        """A successful shard delivery must not clear an error a sibling shard
        recorded on the same run."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = SeerNightShiftRun.objects.create(organization=org, extras={"options": {}})
        failed_seer_run = self.create_seer_run(organization=org)
        ok_seer_run = self.create_seer_run(organization=org)
        failed_shard = SeerNightShiftRunShard.objects.create(run=run, seer_run=failed_seer_run)
        SeerNightShiftRunShard.objects.create(run=run, seer_run=ok_seer_run)

        deliver_night_shift_result(
            organization_id=org.id,
            run_uuid=str(failed_seer_run.uuid),
            status="error",
            result=None,
            error="shard failed",
        )
        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent", return_value=1):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=str(ok_seer_run.uuid),
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
            "sentry.seer.night_shift.delivery.trigger_autofix_agent", return_value=42
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

        def trigger_side_effect(**kwargs: Any) -> int:
            if kwargs["group"].id == failing_group.id:
                raise RuntimeError("trigger failed")
            return 7

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
            "sentry.seer.night_shift.delivery.trigger_autofix_agent", return_value=1
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
        shard = run.shards.get()
        shard.update(extras={"error_message": "Night shift run failed"})

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "fixable"}
            ]
        }

        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent", return_value=1):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

        shard.refresh_from_db()
        assert "error_message" not in shard.extras

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
            "sentry.seer.night_shift.delivery.trigger_autofix_agent", return_value=11
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

        with patch("sentry.seer.night_shift.delivery.trigger_autofix_agent", return_value=99):
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
            "sentry.seer.night_shift.delivery.trigger_autofix_agent", return_value=1
        ) as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=self._run_uuid(run),
                status="completed",
                result=result,
                error=None,
            )

            assert mock_trigger.call_args.kwargs["user_context"] is None
