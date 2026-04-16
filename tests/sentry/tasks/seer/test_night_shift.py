from unittest.mock import patch

from django.utils import timezone

from sentry.models.group import Group
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.explorer.client_models import Artifact, MemoryBlock, Message, SeerRunState
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunIssue
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.seer.night_shift.cron import (
    _get_eligible_projects,
    run_night_shift_for_org,
    schedule_night_shift,
)
from sentry.tasks.seer.night_shift.simple_triage import fixability_score_strategy
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.pytest.fixtures import django_db_all


class FakeExplorerClient:
    """Stub SeerExplorerClient that returns canned triage verdicts."""

    def __init__(self, group_ids: list[int], action: str = "autofix"):
        verdicts = [{"group_id": gid, "action": action, "reason": "test"} for gid in group_ids]
        artifact = Artifact(key="triage_verdicts", data={"verdicts": verdicts}, reason="test")
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
    def test_disabled_by_option(self) -> None:
        with (
            self.options({"seer.night_shift.enable": False}),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()

    def test_dispatches_eligible_orgs(self) -> None:
        org = self.create_organization()

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_called_once()
            assert mock_worker.apply_async.call_args.kwargs["args"] == [org.id]

    def test_skips_ineligible_orgs(self) -> None:
        self.create_organization()

        with (
            self.options({"seer.night_shift.enable": True}),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()

    def test_skips_orgs_with_hidden_ai(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:hide_ai_features", True)

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()


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

        with self.feature("organizations:seer-project-settings-read-from-sentry"):
            projects, preferences = _get_eligible_projects(org)
            assert projects == [eligible]
            assert eligible.id in preferences


@django_db_all
class TestRunNightShiftForOrg(TestCase, SnubaTestCase):
    reset_snuba_data = False

    def _make_eligible(self, project):
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        repo = self.create_repo(project=project, provider="github", name=f"owner/{project.slug}")
        SeerProjectRepository.objects.create(project=project, repository=repo)

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

    def test_nonexistent_org(self) -> None:
        with patch("sentry.tasks.seer.night_shift.cron.logger") as mock_logger:
            run_night_shift_for_org(999999999)
            mock_logger.info.assert_not_called()

    def test_no_eligible_projects(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            self.feature("organizations:seer-project-settings-read-from-sentry"),
            patch("sentry.tasks.seer.night_shift.cron.logger") as mock_logger,
        ):
            run_night_shift_for_org(org.id)
            mock_logger.info.assert_called_once()
            assert mock_logger.info.call_args.args[0] == "night_shift.no_eligible_projects"

        assert not SeerNightShiftRun.objects.filter(organization=org).exists()

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
        # Already triggered — should be excluded
        self._store_event_and_update_group(
            project,
            "triggered",
            seer_fixability_score=0.95,
            seer_autofix_last_triggered=timezone.now(),
        )

        fake_client = FakeExplorerClient([high_fix.id, low_fix.id])
        with (
            self.feature("organizations:seer-project-settings-read-from-sentry"),
            patch(
                "sentry.tasks.seer.night_shift.agentic_triage.SeerExplorerClient",
                return_value=fake_client,
            ),
            patch("sentry.tasks.seer.night_shift.cron.logger") as mock_logger,
        ):
            run_night_shift_for_org(org.id)

            call_extra = mock_logger.info.call_args.kwargs["extra"]
            assert call_extra["num_candidates"] == 2
            candidates = call_extra["candidates"]
            assert candidates[0]["group_id"] == high_fix.id
            assert candidates[1]["group_id"] == low_fix.id

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.triage_strategy == "agentic_triage"
        assert run.error_message is None

        issues = list(SeerNightShiftRunIssue.objects.filter(run=run))
        assert len(issues) == 2
        issue_group_ids = {i.group_id for i in issues}
        assert issue_group_ids == {high_fix.id, low_fix.id}

    def test_global_ranking_across_projects(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        self._make_eligible(project_a)
        self._make_eligible(project_b)

        low_group = self._store_event_and_update_group(
            project_a, "low-group", seer_fixability_score=0.3
        )
        high_group = self._store_event_and_update_group(
            project_b, "high-group", seer_fixability_score=0.95
        )

        fake_client = FakeExplorerClient([high_group.id, low_group.id])
        with (
            self.feature("organizations:seer-project-settings-read-from-sentry"),
            patch(
                "sentry.tasks.seer.night_shift.agentic_triage.SeerExplorerClient",
                return_value=fake_client,
            ),
            patch("sentry.tasks.seer.night_shift.cron.logger") as mock_logger,
        ):
            run_night_shift_for_org(org.id)

            candidates = mock_logger.info.call_args.kwargs["extra"]["candidates"]
            assert candidates[0]["group_id"] == high_group.id
            assert candidates[1]["group_id"] == low_group.id

    def test_triage_error_records_error_message(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with (
            self.feature("organizations:seer-project-settings-read-from-sentry"),
            patch(
                "sentry.tasks.seer.night_shift.cron.agentic_triage_strategy",
                side_effect=RuntimeError("boom"),
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.error_message == "Night shift run failed"
        assert not SeerNightShiftRunIssue.objects.filter(run=run).exists()

    def test_triggers_autofix_for_fixable_candidates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        group = self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        fake_client = FakeExplorerClient([group.id], action="autofix")
        with (
            self.feature("organizations:seer-project-settings-read-from-sentry"),
            patch(
                "sentry.tasks.seer.night_shift.agentic_triage.SeerExplorerClient",
                return_value=fake_client,
            ),
            patch("sentry.tasks.seer.night_shift.cron._trigger_autofix_task") as mock_autofix_task,
        ):
            run_night_shift_for_org(org.id)

            mock_autofix_task.delay.assert_called_once()
            call_kwargs = mock_autofix_task.delay.call_args.kwargs
            assert call_kwargs["group_id"] == group.id
            assert call_kwargs["user_id"] is None
            assert call_kwargs["auto_run_source"] == "night_shift"

    def test_dry_run_skips_autofix(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        group = self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        fake_client = FakeExplorerClient([group.id], action="autofix")
        with (
            self.feature("organizations:seer-project-settings-read-from-sentry"),
            patch(
                "sentry.tasks.seer.night_shift.agentic_triage.SeerExplorerClient",
                return_value=fake_client,
            ),
            patch("sentry.tasks.seer.night_shift.cron._trigger_autofix_task") as mock_autofix_task,
        ):
            run_night_shift_for_org(org.id, dry_run=True)

            mock_autofix_task.delay.assert_not_called()

        # Candidates should still be saved to DB
        run = SeerNightShiftRun.objects.get(organization=org)
        assert SeerNightShiftRunIssue.objects.filter(run=run).count() == 1

    def test_skips_autofix_for_non_autofix_candidates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        group = self._store_event_and_update_group(
            project, "skip-me", seer_fixability_score=0.9, times_seen=5
        )

        fake_client = FakeExplorerClient([group.id], action="root_cause_only")
        with (
            self.feature("organizations:seer-project-settings-read-from-sentry"),
            patch(
                "sentry.tasks.seer.night_shift.agentic_triage.SeerExplorerClient",
                return_value=fake_client,
            ),
            patch("sentry.tasks.seer.night_shift.cron._trigger_autofix_task") as mock_autofix_task,
        ):
            run_night_shift_for_org(org.id)

            mock_autofix_task.delay.assert_not_called()

    def test_empty_candidates_creates_run_with_no_issues(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with (
            self.feature("organizations:seer-project-settings-read-from-sentry"),
            patch(
                "sentry.tasks.seer.night_shift.cron.agentic_triage_strategy",
                return_value=([], None),
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.error_message is None
        assert not SeerNightShiftRunIssue.objects.filter(run=run).exists()


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

        result = fixability_score_strategy([project])

        assert result[0].group.id == high.id
        assert result[0].fixability == 0.9
        assert result[0].times_seen == 5
        assert result[0].severity == 1.0
        assert result[1].group.id == low.id
