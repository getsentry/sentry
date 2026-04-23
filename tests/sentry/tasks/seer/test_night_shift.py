import itertools
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from sentry.models.group import Group
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import AutofixStoppingPoint
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

NIGHT_SHIFT_FEATURES = [
    "organizations:seer-project-settings-read-from-sentry",
    "projects:seer-night-shift",
]


class FakeExplorerClient:
    """Stub SeerExplorerClient that returns canned triage verdicts."""

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
                    "organizations:seat-based-seer-enabled": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.cron.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_called_once()
            assert mock_worker.apply_async.call_args.kwargs["args"] == [org.id]

    def test_skips_orgs_without_seat_based_seer(self) -> None:
        org = self.create_organization()

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
        org = self.create_organization()
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

        with self.feature(NIGHT_SHIFT_FEATURES):
            projects, preferences = _get_eligible_projects(org)
            assert projects == [eligible]
            assert eligible.id in preferences

    def test_filters_by_project_flag_disabled(self) -> None:
        org = self.create_organization()

        project = self.create_project(organization=org)
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        repo = self.create_repo(project=project, provider="github", name="owner/repo")
        SeerProjectRepository.objects.create(project=project, repository=repo)

        with self.feature(
            {
                "organizations:seer-project-settings-read-from-sentry": True,
                "projects:seer-night-shift": False,
            }
        ):
            projects, _ = _get_eligible_projects(org)
            assert projects == []


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
            self.feature(NIGHT_SHIFT_FEATURES),
            patch(
                "sentry.tasks.seer.night_shift.agentic_triage.SeerExplorerClient",
                return_value=fake_client,
            ),
            patch(
                "sentry.tasks.seer.night_shift.cron.trigger_autofix_explorer",
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
            self.feature(NIGHT_SHIFT_FEATURES),
            patch("sentry.tasks.seer.night_shift.cron.logger") as mock_logger,
        ):
            run_night_shift_for_org(org.id)
            mock_logger.info.assert_called_once()
            assert mock_logger.info.call_args.args[0] == "night_shift.no_eligible_projects"

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.error_message is None
        assert not SeerNightShiftRunIssue.objects.filter(run=run).exists()

    def test_eligible_projects_error_records_error_message(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            self.feature(NIGHT_SHIFT_FEATURES),
            patch(
                "sentry.tasks.seer.night_shift.cron._get_eligible_projects",
                side_effect=RuntimeError("boom"),
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.error_message == "Failed to get eligible projects"
        assert not SeerNightShiftRunIssue.objects.filter(run=run).exists()

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
        assert run.triage_strategy == "agentic_triage"
        assert run.error_message is None
        assert run.extras == {"agent_run_id": 1}

        issue_group_ids = set(
            SeerNightShiftRunIssue.objects.filter(run=run).values_list("group_id", flat=True)
        )
        assert issue_group_ids == {high_fix.id, low_fix.id}

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
            self.feature(NIGHT_SHIFT_FEATURES),
            patch(
                "sentry.tasks.seer.night_shift.agentic_triage.SeerExplorerClient",
                return_value=mock_client,
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.error_message == "Night shift run failed"
        assert not SeerNightShiftRunIssue.objects.filter(run=run).exists()

    def test_triggers_autofix_with_correct_stopping_point(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

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
        issue_run_ids = dict(
            SeerNightShiftRunIssue.objects.filter(run=run).values_list("group_id", "seer_run_id")
        )
        assert issue_run_ids == {autofix_group.id: "42", root_cause_group.id: "99"}

    def test_dry_run_skips_autofix(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        group = self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with self._patched_night_shift([(group.id, "autofix")]) as (mock_trigger, mock_logger):
            run_night_shift_for_org(org.id, dry_run=True)

            mock_trigger.assert_not_called()
            call_extra = mock_logger.info.call_args.kwargs["extra"]
            assert call_extra["dry_run"] is True
            assert call_extra["candidates"][0]["seer_run_id"] is None

        # Dry runs don't perform any Seer work, so no issue rows are written.
        run = SeerNightShiftRun.objects.get(organization=org)
        assert SeerNightShiftRunIssue.objects.filter(run=run).count() == 0

    def test_skips_autofix_for_skip_candidates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        group = self._store_event_and_update_group(
            project, "skip-me", seer_fixability_score=0.9, times_seen=5
        )

        with self._patched_night_shift([(group.id, "skip")]) as (mock_trigger, mock_logger):
            run_night_shift_for_org(org.id)

            mock_trigger.assert_not_called()
            log_calls = [call.args[0] for call in mock_logger.info.call_args_list]
            assert "night_shift.no_fixable_candidates" in log_calls

        run = SeerNightShiftRun.objects.get(organization=org)
        assert not SeerNightShiftRunIssue.objects.filter(run=run).exists()

    def test_skips_autofix_when_no_seer_quota(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with (
            self.feature(NIGHT_SHIFT_FEATURES),
            patch(
                "sentry.tasks.seer.night_shift.cron.quotas.backend.check_seer_quota",
                return_value=False,
            ),
            patch("sentry.tasks.seer.night_shift.cron.agentic_triage_strategy") as mock_triage,
            patch(
                "sentry.tasks.seer.night_shift.cron.trigger_autofix_explorer",
            ) as mock_trigger,
        ):
            run_night_shift_for_org(org.id)

            # Triage and trigger are both skipped when the org has no quota.
            mock_triage.assert_not_called()
            mock_trigger.assert_not_called()

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.error_message == "No Seer quota available"
        assert not SeerNightShiftRunIssue.objects.filter(run=run).exists()

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
        issue_run_ids = dict(
            SeerNightShiftRunIssue.objects.filter(run=run).values_list("group_id", "seer_run_id")
        )
        assert issue_run_ids == {ok_group.id: "7"}


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
