from typing import Any
from unittest.mock import patch

from sentry.models.organization import Organization
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunResult
from sentry.seer.night_shift.delivery import deliver_night_shift_result
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
        """Create a SeerNightShiftRun with associated SeerRun."""
        org = organization or self.create_organization()
        seer_run = self.create_seer_run(organization=org)
        extras = {"options": {}, **extras_overrides}
        return SeerNightShiftRun.objects.create(
            organization=org,
            seer_run=seer_run,
            extras=extras,
        )

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
        """When status is 'error', record error message and return early."""
        run = self._create_night_shift_run()
        assert run.seer_run is not None

        with patch("sentry.seer.night_shift.delivery.logger") as mock_logger:
            deliver_night_shift_result(
                organization_id=run.organization_id,
                run_uuid=str(run.seer_run.uuid),
                status="error",
                result=None,
                error="Seer exploded",
            )

            mock_logger.warning.assert_called()
            assert "night_shift.delivery.no_result" in mock_logger.warning.call_args.args[0]

        run.refresh_from_db()
        assert run.extras["error_message"] == "Seer exploded"
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_invalid_result_logs_exception(self) -> None:
        """When result can't be parsed as TriageResponse, log and return."""
        run = self._create_night_shift_run()
        assert run.seer_run is not None

        with patch("sentry.seer.night_shift.delivery.logger") as mock_logger:
            deliver_night_shift_result(
                organization_id=run.organization_id,
                run_uuid=str(run.seer_run.uuid),
                status="completed",
                result={"invalid": "schema"},
                error=None,
            )

            mock_logger.exception.assert_called_once()
            assert "night_shift.delivery.invalid_result" in mock_logger.exception.call_args.args[0]

        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_skip_verdict_marks_group_skipped(self) -> None:
        """SKIP verdicts should mark the group in skip cache."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.SKIP.value, "reason": "not fixable"}
            ]
        }

        assert run.seer_run is not None
        with patch("sentry.tasks.seer.night_shift.cron.trigger_autofix_agent") as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=str(run.seer_run.uuid),
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

        # No results persisted for SKIP verdicts
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

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

        assert run.seer_run is not None
        with patch(
            "sentry.tasks.seer.night_shift.cron.trigger_autofix_agent", return_value=42
        ) as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=str(run.seer_run.uuid),
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

    def test_root_cause_only_verdict_is_not_actioned(self) -> None:
        """ROOT_CAUSE_ONLY verdicts are intentionally ignored."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        project.update_option(
            "sentry:seer_automated_run_stopping_point", AutofixStoppingPoint.OPEN_PR.value
        )
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

        assert run.seer_run is not None
        with patch(
            "sentry.tasks.seer.night_shift.cron.trigger_autofix_agent", return_value=99
        ) as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=str(run.seer_run.uuid),
                status="completed",
                result=result,
                error=None,
            )

            mock_trigger.assert_not_called()

        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_dry_run_skips_autofix(self) -> None:
        """Dry run mode should not trigger autofix or persist results."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org, options={"dry_run": True})

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "fixable"}
            ]
        }

        assert run.seer_run is not None
        with patch("sentry.tasks.seer.night_shift.cron.trigger_autofix_agent") as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=str(run.seer_run.uuid),
                status="completed",
                result=result,
                error=None,
            )

            mock_trigger.assert_not_called()

        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

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

        assert run.seer_run is not None
        with (
            patch(
                "sentry.tasks.seer.night_shift.cron.trigger_autofix_agent",
                side_effect=trigger_side_effect,
            ),
            patch("sentry.tasks.seer.night_shift.cron.logger") as mock_logger,
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=str(run.seer_run.uuid),
                status="completed",
                result=result,
                error=None,
            )

            exception_calls = [call.args[0] for call in mock_logger.exception.call_args_list]
            assert "night_shift.autofix_trigger_failed" in exception_calls

        results = list(SeerNightShiftRunResult.objects.filter(run=run))
        assert len(results) == 1
        assert results[0].group_id == ok_group.id
        assert results[0].seer_run_id == "7"

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

        assert run.seer_run is not None
        with (
            patch("sentry.tasks.seer.night_shift.cron.trigger_autofix_agent") as mock_trigger,
            patch("sentry.seer.night_shift.delivery.logger") as mock_logger,
        ):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=str(run.seer_run.uuid),
                status="completed",
                result=result,
                error=None,
            )

            mock_trigger.assert_not_called()
            warning_calls = [call.args[0] for call in mock_logger.warning.call_args_list]
            assert "night_shift.delivery.unknown_group_ids" in warning_calls

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

        assert run.seer_run is not None
        with patch(
            "sentry.tasks.seer.night_shift.cron.trigger_autofix_agent", return_value=1
        ) as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=str(run.seer_run.uuid),
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
        run = self._create_night_shift_run(organization=org, error_message="Night shift run failed")

        result = {
            "verdicts": [
                {"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": "fixable"}
            ]
        }

        assert run.seer_run is not None
        with patch("sentry.tasks.seer.night_shift.cron.trigger_autofix_agent", return_value=1):
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=str(run.seer_run.uuid),
                status="completed",
                result=result,
                error=None,
            )

        run.refresh_from_db()
        assert "error_message" not in run.extras

    def test_empty_reason_no_user_context(self) -> None:
        """Empty reason should result in no user_context."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        run = self._create_night_shift_run(organization=org)

        result = {
            "verdicts": [{"group_id": group.id, "action": TriageAction.AUTOFIX.value, "reason": ""}]
        }

        assert run.seer_run is not None
        with patch(
            "sentry.tasks.seer.night_shift.cron.trigger_autofix_agent", return_value=1
        ) as mock_trigger:
            deliver_night_shift_result(
                organization_id=org.id,
                run_uuid=str(run.seer_run.uuid),
                status="completed",
                result=result,
                error=None,
            )

            assert mock_trigger.call_args.kwargs["user_context"] is None
