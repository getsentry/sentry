from unittest.mock import patch

from django.utils import timezone

from sentry.models.group import GroupStatus
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.seer.night_shift import (
    _fixability_score_strategy,
    _get_eligible_projects,
    run_night_shift_for_org,
    schedule_night_shift,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestScheduleNightShift(TestCase):
    def test_disabled_by_option(self) -> None:
        with (
            self.options({"seer.night_shift.enable": False}),
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
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
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_called_once()
            assert mock_worker.apply_async.call_args.kwargs["args"] == [org.id]

    def test_skips_ineligible_orgs(self) -> None:
        self.create_organization()

        with (
            self.options({"seer.night_shift.enable": True}),
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
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
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
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
        repo = self.create_repo(project=eligible, provider="github")
        SeerProjectRepository.objects.create(project=eligible, repository=repo)

        # Automation off (even with repo)
        off = self.create_project(organization=org)
        off.update_option("sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF)
        repo2 = self.create_repo(project=off, provider="github")
        SeerProjectRepository.objects.create(project=off, repository=repo2)

        # No connected repo
        self.create_project(organization=org)

        assert _get_eligible_projects(org) == [eligible]


@django_db_all
class TestRunNightShiftForOrg(TestCase):
    def _make_eligible(self, project):
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        repo = self.create_repo(project=project, provider="github")
        SeerProjectRepository.objects.create(project=project, repository=repo)

    def test_nonexistent_org(self) -> None:
        with patch("sentry.tasks.seer.night_shift.logger") as mock_logger:
            run_night_shift_for_org(999999999)
            mock_logger.info.assert_not_called()

    def test_no_eligible_projects(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with patch("sentry.tasks.seer.night_shift.logger") as mock_logger:
            run_night_shift_for_org(org.id)
            mock_logger.info.assert_called_once()
            assert mock_logger.info.call_args.args[0] == "night_shift.no_eligible_projects"

    def test_selects_candidates_and_skips_triggered(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        high_fix = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.9,
            times_seen=5,
        )
        low_fix = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.2,
            times_seen=100,
        )
        # Already triggered — should be excluded
        self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.95,
            seer_autofix_last_triggered=timezone.now(),
        )

        with patch("sentry.tasks.seer.night_shift.logger") as mock_logger:
            run_night_shift_for_org(org.id)

            call_extra = mock_logger.info.call_args.kwargs["extra"]
            assert call_extra["num_candidates"] == 2
            candidates = call_extra["candidates"]
            assert candidates[0]["group_id"] == high_fix.id
            assert candidates[1]["group_id"] == low_fix.id

    def test_global_ranking_across_projects(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        self._make_eligible(project_a)
        self._make_eligible(project_b)

        low_group = self.create_group(
            project=project_a,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.3,
        )
        high_group = self.create_group(
            project=project_b,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.95,
        )

        with patch("sentry.tasks.seer.night_shift.logger") as mock_logger:
            run_night_shift_for_org(org.id)

            candidates = mock_logger.info.call_args.kwargs["extra"]["candidates"]
            assert candidates[0]["group_id"] == high_group.id
            assert candidates[0]["project_id"] == project_b.id
            assert candidates[1]["group_id"] == low_group.id
            assert candidates[1]["project_id"] == project_a.id


@django_db_all
class TestFixabilityScoreStrategy(TestCase):
    @patch("sentry.tasks.seer.night_shift.NIGHT_SHIFT_ISSUE_FETCH_LIMIT", 3)
    def test_ranks_and_captures_signals(self) -> None:
        project = self.create_project()
        high = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.9,
            times_seen=5,
            priority=75,
        )
        low = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.2,
            times_seen=500,
        )
        # NULL-scored issues should sort after scored ones even with a tight DB limit.
        # Without nulls_last these would fill the limit and exclude scored issues.
        for _ in range(3):
            self.create_group(
                project=project,
                status=GroupStatus.UNRESOLVED,
                seer_fixability_score=None,
                times_seen=100,
            )

        result = _fixability_score_strategy([project])

        assert result[0].group_id == high.id
        assert result[0].fixability == 0.9
        assert result[0].times_seen == 5
        assert result[0].severity == 1.0
        assert result[1].group_id == low.id
