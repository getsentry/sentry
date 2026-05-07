import itertools
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from sentry.models.group import Group
from sentry.models.organization import OrganizationStatus
from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunResult
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.seer.night_shift.cron import (
    _get_eligible_projects,
    run_night_shift_for_org,
    schedule_night_shift,
)
from sentry.tasks.seer.night_shift.models import TriageAction
from sentry.tasks.seer.night_shift.simple_triage import fixability_score_strategy
from sentry.tasks.seer.night_shift.skip_cache import key as skip_cache_key
from sentry.tasks.seer.night_shift.skip_cache import mark_skipped
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.redis import redis_clusters


class FakeExplorerClient:
    """Stub SeerAgentClient that returns canned triage verdicts."""

    def __init__(self, verdicts: list[tuple[int, str]]):
        verdict_dicts = [
            {"group_id": gid, "action": action, "reason": "test"} for gid, action in verdicts
        ]
        artifact = Artifact(key="triage_verdicts", data={"verdicts": verdict_dicts}, reason="test")
        self._state = SeerRunState(
            run_id=1,
            blocks=[
                MemoryBlock(
                    id="test-block",
                    message=Message(role="assistant"),
                    timestamp="2025-01-01T00:00:00",
                    artifacts=[artifact],
                ),
            ],
            status="completed",
            updated_at="2025-01-01T00:00:00",
        )

    def start_run(self, **kwargs):
        return 1

    def get_run(self, run_id, **kwargs):
        return self._state


@django_db_all
class TestScheduleNightShift(TestCase):
    def create_org_with_seer(self):
        """Create an org with a SeerProjectRepository so it survives the pre-filter."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        repo = self.create_repo(project=project, provider="github", name=f"owner/{project.slug}")
        SeerProjectRepository.objects.create(project=project, repository=repo)
        return org

    def test_disabled_by_option(self) -> None:
        with (
            self.options({"seer.night_shift.enable": False}),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()

    def test_dispatches_eligible_orgs(self) -> None:
        org = self.create_org_with_seer()

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                    "organizations:seat-based-seer-enabled": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_called_once()
            assert mock_worker.apply_async.call_args.kwargs["args"] == [org.id]
            assert mock_worker.apply_async.call_args.kwargs["kwargs"] == {}

    def test_dispatches_with_run_options(self) -> None:
        org = self.create_org_with_seer()

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                    "organizations:seat-based-seer-enabled": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift(
                run_options={"source": "manual", "dry_run": True, "max_candidates": 3}
            )
            mock_worker.apply_async.assert_called_once()
            assert mock_worker.apply_async.call_args.kwargs["args"] == [org.id]
            assert mock_worker.apply_async.call_args.kwargs["kwargs"] == {
                "options": {"source": "manual", "dry_run": True, "max_candidates": 3},
            }

    def test_skips_orgs_without_seat_based_seer(self) -> None:
        org = self.create_org_with_seer()

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                    # seat-based-seer-enabled intentionally omitted
                }
            ),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()

    def test_skips_orgs_with_hidden_ai(self) -> None:
        org = self.create_org_with_seer()
        org.update_option("sentry:hide_ai_features", True)

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                    "organizations:seat-based-seer-enabled": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()

    def test_skips_orgs_without_seer_project_repository(self) -> None:
        # Orgs that have never connected a Seer repo are pre-filtered before
        # the feature flag fanout — even if they happen to have all the flags.
        org = self.create_organization()

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                    "organizations:seat-based-seer-enabled": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
            patch(
                "sentry.tasks.seer.night_shift.cron.features.batch_has_for_organizations"
            ) as mock_batch_has,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()
            mock_batch_has.assert_not_called()


@django_db_all
class TestGetEligibleProjects(TestCase):
    def test_filters_by_automation_and_repos(self) -> None:
        org = self.create_organization()

        # Eligible: automation on + connected repo
        eligible = self.create_project(organization=org)
        eligible.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        repo = self.create_repo(project=eligible, provider="github", name="owner/eligible-repo")
        SeerProjectRepository.objects.create(project=eligible, repository=repo)

        # Automation off (even with repo)
        off = self.create_project(organization=org)
        off.update_option("sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF)
        repo2 = self.create_repo(project=off, provider="github", name="owner/off-repo")
        SeerProjectRepository.objects.create(project=off, repository=repo2)

        # No connected repo
        self.create_project(organization=org)

        eligible.update_option("sentry:seer_nightshift_tweaks", {"enabled": True})

        result = _get_eligible_projects(org, "manual")

        assert [ep.project for ep in result] == [eligible]
        assert result[0].tweaks.enabled is True

    def test_filters_by_project_id(self) -> None:
        org = self.create_organization()

        target = self.create_project(organization=org)
        target.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        target_repo = self.create_repo(project=target, provider="github", name="owner/target")
        SeerProjectRepository.objects.create(project=target, repository=target_repo)

        other = self.create_project(organization=org)
        other.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        other_repo = self.create_repo(project=other, provider="github", name="owner/other")
        SeerProjectRepository.objects.create(project=other, repository=other_repo)

        result = _get_eligible_projects(org, "manual", project_ids=[target.id])

        assert [ep.project for ep in result] == [target]

    def test_cron_filters_disabled_tweaks_manual_keeps_them(self) -> None:
        org = self.create_organization()

        for slug, enabled in (("on", True), ("off", False)):
            project = self.create_project(organization=org, slug=slug)
            project.update_option(
                "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
            )
            repo = self.create_repo(project=project, provider="github", name=f"owner/{slug}")
            SeerProjectRepository.objects.create(project=project, repository=repo)
            project.update_option("sentry:seer_nightshift_tweaks", {"enabled": enabled})

        cron_result = _get_eligible_projects(org, "cron")
        manual_result = _get_eligible_projects(org, "manual")

        assert [ep.project.slug for ep in cron_result] == ["on"]
        assert sorted(ep.project.slug for ep in manual_result) == ["off", "on"]


@django_db_all
class TestRunNightShiftForOrg(TestCase, SnubaTestCase):
    reset_snuba_data = False

    def _make_eligible(self, project, **tweak_overrides):
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        repo = self.create_repo(project=project, provider="github", name=f"owner/{project.slug}")
        SeerProjectRepository.objects.create(project=project, repository=repo)
        project.update_option("sentry:seer_nightshift_tweaks", {"enabled": True, **tweak_overrides})

    def _store_event_and_update_group(self, project, fingerprint, **group_attrs):
        event = self.store_event(
            data={
                "fingerprint": [fingerprint],
                "timestamp": before_now(hours=1).isoformat(),
                "environment": "production",
            },
            project_id=project.id,
        )
        Group.objects.filter(id=event.group_id).update(**group_attrs)
        return Group.objects.get(id=event.group_id)

    @contextmanager
    def _patched_night_shift(
        self,
        verdicts: list[tuple[int, str]],
        *,
        trigger: Callable | None = None,
    ) -> Iterator[tuple[MagicMock, MagicMock]]:
        # Default trigger assigns sequential Seer run ids (100, 101, ...) so each
        # candidate gets a distinct id, matching real-world behavior.
        counter = itertools.count(100)
        side_effect = trigger if trigger is not None else (lambda **kwargs: next(counter))

        fake_client = FakeExplorerClient(verdicts)
        with (
            patch(
                "sentry.tasks.seer.night_shift.agentic_triage.SeerAgentClient",
                return_value=fake_client,
            ),
            patch(
                "sentry.tasks.seer.night_shift.cron.trigger_autofix_agent",
                side_effect=side_effect,
            ) as mock_trigger,
            patch("sentry.tasks.seer.night_shift.cron.logger") as mock_logger,
        ):
            yield mock_trigger, mock_logger

    def test_nonexistent_org(self) -> None:
        with patch("sentry.tasks.seer.night_shift.cron.logger") as mock_logger:
            run_night_shift_for_org(999999999)
            mock_logger.info.assert_not_called()

    def test_no_eligible_projects(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            patch("sentry.tasks.seer.night_shift.cron.logger") as mock_logger,
        ):
            run_night_shift_for_org(org.id)
            info_events = [call.args[0] for call in mock_logger.info.call_args_list]
            assert "night_shift.no_eligible_projects" in info_events

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.extras.get("error_message") is None
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_eligible_projects_error_records_error_message(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            patch(
                "sentry.tasks.seer.night_shift.cron._get_eligible_projects",
                side_effect=RuntimeError("boom"),
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.extras["error_message"] == "Failed to get eligible projects"
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_selects_candidates_and_skips_triggered(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        high_fix = self._store_event_and_update_group(
            project, "high-fix", seer_fixability_score=0.9, times_seen=5
        )
        low_fix = self._store_event_and_update_group(
            project, "low-fix", seer_fixability_score=0.2, times_seen=100
        )
        # Already triggered — should be excluded from triage.
        self._store_event_and_update_group(
            project,
            "triggered",
            seer_fixability_score=0.95,
            seer_autofix_last_triggered=before_now(minutes=5),
        )

        verdicts = [(high_fix.id, "autofix"), (low_fix.id, "autofix")]
        with self._patched_night_shift(verdicts) as (_mock_trigger, mock_logger):
            run_night_shift_for_org(org.id)

            call_extra = mock_logger.info.call_args.kwargs["extra"]
            assert call_extra["num_candidates"] == 2
            candidates = call_extra["candidates"]
            assert candidates[0]["group_id"] == high_fix.id
            assert candidates[1]["group_id"] == low_fix.id
            # Both candidates were triggered and each carries its own Seer run id.
            assert candidates[0]["seer_run_id"] == "100"
            assert candidates[1]["seer_run_id"] == "101"

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.extras.get("error_message") is None
        assert run.extras == {
            "options": {
                "source": "cron",
                "max_candidates": 10,
                "dry_run": False,
                "intelligence_level": "high",
                "reasoning_effort": "high",
                "extra_triage_instructions": "",
            },
            "agent_run_id": 1,
        }

        result_group_ids = set(
            SeerNightShiftRunResult.objects.filter(run=run, kind="agentic_triage").values_list(
                "group_id", flat=True
            )
        )
        assert result_group_ids == {high_fix.id, low_fix.id}

    def test_explorer_triage_error_propagates_to_run(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        mock_client = MagicMock()
        mock_client.start_run.side_effect = RuntimeError("explorer down")
        with (
            patch(
                "sentry.tasks.seer.night_shift.agentic_triage.SeerAgentClient",
                return_value=mock_client,
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.extras["error_message"] == "Night shift run failed"
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_triggers_autofix_with_correct_stopping_point(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)
        project.update_option(
            "sentry:seer_automated_run_stopping_point", AutofixStoppingPoint.OPEN_PR.value
        )

        autofix_group = self._store_event_and_update_group(
            project, "autofix", seer_fixability_score=0.9, times_seen=5
        )
        root_cause_group = self._store_event_and_update_group(
            project, "root-cause", seer_fixability_score=0.8, times_seen=5
        )

        run_ids = {autofix_group.id: 42, root_cause_group.id: 99}
        verdicts = [(autofix_group.id, "autofix"), (root_cause_group.id, "root_cause_only")]
        with self._patched_night_shift(
            verdicts, trigger=lambda **kwargs: run_ids[kwargs["group"].id]
        ) as (mock_trigger, _):
            run_night_shift_for_org(org.id)

        stopping_points_by_group = {
            call.kwargs["group"].id: call.kwargs["stopping_point"]
            for call in mock_trigger.call_args_list
        }
        assert stopping_points_by_group[autofix_group.id] == AutofixStoppingPoint.OPEN_PR
        assert stopping_points_by_group[root_cause_group.id] == AutofixStoppingPoint.ROOT_CAUSE

        run = SeerNightShiftRun.objects.get(organization=org)
        result_run_ids = dict(
            SeerNightShiftRunResult.objects.filter(run=run, kind="agentic_triage").values_list(
                "group_id", "seer_run_id"
            )
        )
        assert result_run_ids == {autofix_group.id: "42", root_cause_group.id: "99"}

    def test_autofix_stopping_point_honors_project_preference(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)
        project.update_option(
            "sentry:seer_automated_run_stopping_point", AutofixStoppingPoint.SOLUTION.value
        )

        group = self._store_event_and_update_group(
            project, "autofix", seer_fixability_score=0.9, times_seen=5
        )

        with self._patched_night_shift([(group.id, "autofix")]) as (mock_trigger, _):
            run_night_shift_for_org(org.id)

        assert mock_trigger.call_args.kwargs["stopping_point"] == AutofixStoppingPoint.SOLUTION

    def test_forwards_reasoning_effort_to_trigger(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        group = self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with self._patched_night_shift([(group.id, "autofix")]) as (mock_trigger, _):
            run_night_shift_for_org(org.id, options={"reasoning_effort": "low"})

        mock_trigger.assert_called_once()
        assert mock_trigger.call_args.kwargs["reasoning_effort"] == "low"

    def test_dry_run_skips_autofix(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        group = self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with self._patched_night_shift([(group.id, "autofix")]) as (mock_trigger, mock_logger):
            run_night_shift_for_org(org.id, options={"dry_run": True})

            mock_trigger.assert_not_called()
            call_extra = mock_logger.info.call_args.kwargs["extra"]
            assert call_extra["dry_run"] is True
            assert call_extra["candidates"][0]["seer_run_id"] is None

        # Dry runs don't perform any Seer work, so no result rows are written.
        run = SeerNightShiftRun.objects.get(organization=org)
        assert SeerNightShiftRunResult.objects.filter(run=run).count() == 0

    def test_skips_autofix_for_skip_candidates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        group = self._store_event_and_update_group(
            project, "skip-me", seer_fixability_score=0.9, times_seen=5
        )

        with (
            self._patched_night_shift([(group.id, "skip")]) as (mock_trigger, mock_logger),
            patch("sentry.tasks.seer.night_shift.agentic_triage.mark_skipped") as mock_mark_skipped,
        ):
            run_night_shift_for_org(org.id)

            mock_trigger.assert_not_called()
            log_calls = [call.args[0] for call in mock_logger.info.call_args_list]
            assert "night_shift.no_fixable_candidates" in log_calls
            mock_mark_skipped.assert_called_once_with(group.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_filters_recently_skipped_groups(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        skipped_group = self._store_event_and_update_group(
            project, "already-skipped", seer_fixability_score=0.9, times_seen=5
        )
        other_group = self._store_event_and_update_group(
            project, "fresh", seer_fixability_score=0.9, times_seen=5
        )

        mark_skipped(skipped_group.id)
        try:
            with self._patched_night_shift([(other_group.id, "autofix")]) as (mock_trigger, _):
                run_night_shift_for_org(org.id)
        finally:
            redis_clusters.get("default").delete(skip_cache_key(skipped_group.id))

        mock_trigger.assert_called_once()
        assert mock_trigger.call_args.kwargs["group"].id == other_group.id

    def test_skips_autofix_when_no_seer_quota(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with (
            patch(
                "sentry.tasks.seer.night_shift.cron.quotas.backend.check_seer_quota",
                return_value=False,
            ),
            patch("sentry.tasks.seer.night_shift.cron.agentic_triage_strategy") as mock_triage,
            patch(
                "sentry.tasks.seer.night_shift.cron.trigger_autofix_agent",
            ) as mock_trigger,
        ):
            run_night_shift_for_org(org.id)

            # Triage and trigger are both skipped when the org has no quota.
            mock_triage.assert_not_called()
            mock_trigger.assert_not_called()

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.extras["error_message"] == "No Seer quota available"
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_skips_issue_row_on_trigger_failure(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        raising_group = self._store_event_and_update_group(
            project, "raises", seer_fixability_score=0.9, times_seen=5
        )
        ok_group = self._store_event_and_update_group(
            project, "ok", seer_fixability_score=0.8, times_seen=5
        )

        def trigger(**kwargs):
            if kwargs["group"].id == raising_group.id:
                raise RuntimeError("explorer crash")
            return 7

        verdicts = [(raising_group.id, "autofix"), (ok_group.id, "autofix")]
        with self._patched_night_shift(verdicts, trigger=trigger) as (_, mock_logger):
            run_night_shift_for_org(org.id)

            exception_calls = [call.args[0] for call in mock_logger.exception.call_args_list]
            assert "night_shift.autofix_trigger_failed" in exception_calls

        run = SeerNightShiftRun.objects.get(organization=org)
        result_run_ids = dict(
            SeerNightShiftRunResult.objects.filter(run=run, kind="agentic_triage").values_list(
                "group_id", "seer_run_id"
            )
        )
        assert result_run_ids == {ok_group.id: "7"}

    def test_max_candidates_defaults_to_global_option(self) -> None:
        org = self.create_organization()
        low = self.create_project(organization=org, slug="low")
        high = self.create_project(organization=org, slug="high")
        self._make_eligible(low, max_candidates=3)
        self._make_eligible(high, max_candidates=11)

        with (
            patch(
                "sentry.tasks.seer.night_shift.cron.agentic_triage_strategy",
                return_value=([], None),
            ) as mock_triage,
        ):
            run_night_shift_for_org(org.id)

        mock_triage.assert_called_once()
        assert mock_triage.call_args.args[2] == 10

    def test_explicit_max_candidates_overrides_tweaks(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project, max_candidates=50)

        with (
            patch(
                "sentry.tasks.seer.night_shift.cron.agentic_triage_strategy",
                return_value=([], None),
            ) as mock_triage,
        ):
            run_night_shift_for_org(org.id, options={"max_candidates": 7})

        mock_triage.assert_called_once()
        assert mock_triage.call_args.args[2] == 7

    def test_scheduler_skips_projects_with_tweaks_disabled(self) -> None:
        org = self.create_organization()
        enabled = self.create_project(organization=org, slug="on")
        disabled = self.create_project(organization=org, slug="off")
        self._make_eligible(enabled)
        self._make_eligible(disabled, enabled=False)

        with (
            patch(
                "sentry.tasks.seer.night_shift.cron.agentic_triage_strategy",
                return_value=([], None),
            ) as mock_triage,
        ):
            run_night_shift_for_org(org.id)

        mock_triage.assert_called_once()
        assert [p.id for p in mock_triage.call_args.args[0]] == [enabled.id]


@django_db_all
class TestRunNightShiftForOrgManualPath(TestCase):
    """Manual-path coverage for run_night_shift_for_org — invoked from the
    project-settings "Run Now" endpoint with source="manual" and project_ids."""

    def test_inactive_org_skipped(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update(status=OrganizationStatus.PENDING_DELETION)

        with patch("sentry.tasks.seer.night_shift.cron.run_night_shift_execution") as mock_execute:
            run_night_shift_for_org(org.id, options={"source": "manual"}, project_ids=[project.id])
            mock_execute.assert_not_called()
            mock_execute.apply_async.assert_not_called()

    def test_delegates_to_shared_pipeline_with_project_ids(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)

        with patch(
            "sentry.tasks.seer.night_shift.cron.run_night_shift_execution",
        ) as mock_execute:
            result = run_night_shift_for_org(
                org.id,
                options={"source": "manual", "dry_run": True, "max_candidates": 3},
                project_ids=[project.id],
            )

        mock_execute.assert_called_once()
        # Sync invocation passes run_id as the positional arg, options + project_ids as kwargs.
        run_id = mock_execute.call_args.args[0]
        assert result == run_id
        run = SeerNightShiftRun.objects.get(id=run_id)
        assert run.organization_id == org.id
        kwargs = mock_execute.call_args.kwargs
        assert kwargs["options"] == {
            "source": "manual",
            "max_candidates": 3,
            "dry_run": True,
            "intelligence_level": "high",
            "reasoning_effort": "high",
            "extra_triage_instructions": "",
        }
        assert kwargs["project_ids"] == [project.id]

    def test_extras_contain_options_and_target_project_ids(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)

        with patch(
            "sentry.tasks.seer.night_shift.cron.agentic_triage_strategy",
            return_value=([], None),
        ):
            run_night_shift_for_org(
                org.id,
                options={"source": "manual", "dry_run": True, "max_candidates": 5},
                project_ids=[project.id],
            )

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.extras == {
            "options": {
                "source": "manual",
                "max_candidates": 5,
                "dry_run": True,
                "intelligence_level": "high",
                "reasoning_effort": "high",
                "extra_triage_instructions": "",
            },
            "target_project_ids": [project.id],
        }

    def test_extras_contain_triggering_user_id_when_provided(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)

        with patch(
            "sentry.tasks.seer.night_shift.cron.agentic_triage_strategy",
            return_value=([], None),
        ):
            run_night_shift_for_org(
                org.id,
                options={"source": "manual", "dry_run": True},
                project_ids=[project.id],
                triggering_user_id=4242,
            )

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.extras["triggering_user_id"] == 4242

    def test_manual_runs_even_when_project_tweak_is_disabled(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        repo = self.create_repo(project=project, provider="github", name=f"owner/{project.slug}")
        SeerProjectRepository.objects.create(project=project, repository=repo)
        project.update_option("sentry:seer_nightshift_tweaks", {"enabled": False})

        with (
            patch(
                "sentry.tasks.seer.night_shift.cron.agentic_triage_strategy",
                return_value=([], None),
            ) as mock_triage,
        ):
            run_night_shift_for_org(org.id, options={"source": "manual"}, project_ids=[project.id])

        mock_triage.assert_called_once()
        assert [p.id for p in mock_triage.call_args.args[0]] == [project.id]


@django_db_all
class TestFixabilityScoreStrategy(TestCase, SnubaTestCase):
    reset_snuba_data = False

    def _store_event_and_update_group(self, project, fingerprint, **group_attrs):
        event = self.store_event(
            data={
                "fingerprint": [fingerprint],
                "timestamp": before_now(hours=1).isoformat(),
                "environment": "production",
            },
            project_id=project.id,
        )
        Group.objects.filter(id=event.group_id).update(**group_attrs)
        return Group.objects.get(id=event.group_id)

    def test_ranks_and_captures_signals(self) -> None:
        project = self.create_project()
        high = self._store_event_and_update_group(
            project, "high", seer_fixability_score=0.9, times_seen=5, priority=75
        )
        low = self._store_event_and_update_group(
            project, "low", seer_fixability_score=0.2, times_seen=500
        )
        for i in range(3):
            self._store_event_and_update_group(
                project, f"null-{i}", seer_fixability_score=None, times_seen=100
            )

        result = fixability_score_strategy([project], max_candidates=10)

        assert result[0].group.id == high.id
        assert result[0].fixability == 0.9
        assert result[0].times_seen == 5
        assert result[0].severity == 1.0
        assert result[1].group.id == low.id


class TestTriageActionFromFixabilityScore:
    def test_bucket_boundaries(self) -> None:
        cases = [
            (0.0, TriageAction.SKIP),
            (0.39, TriageAction.SKIP),
            (0.40, TriageAction.ROOT_CAUSE_ONLY),
            (0.65, TriageAction.ROOT_CAUSE_ONLY),
            (0.66, TriageAction.AUTOFIX),
            (0.95, TriageAction.AUTOFIX),
        ]
        for score, expected in cases:
            assert TriageAction.from_fixability_score(score) == expected
