from unittest.mock import patch

from sentry.models.group import Group
from sentry.models.organization import OrganizationStatus
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunResult
from sentry.seer.models.workflow import SeerWorkflowStrategy
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


@django_db_all
class TestScheduleNightShift(TestCase):
    def create_org_with_seer(self):
        """Create an org with a SeerProjectRepository so it survives the pre-filter."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        repo = self.create_repo(project=project, provider="github", name=f"owner/{project.slug}")
        self.create_seer_project_repository(project=project, repository=repo)
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
        self.create_seer_project_repository(project=eligible, repository=repo)

        # Automation off (even with repo)
        off = self.create_project(organization=org)
        off.update_option("sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF)
        repo2 = self.create_repo(project=off, provider="github", name="owner/off-repo")
        self.create_seer_project_repository(project=off, repository=repo2)

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
        self.create_seer_project_repository(project=target, repository=target_repo)

        other = self.create_project(organization=org)
        other.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        other_repo = self.create_repo(project=other, provider="github", name="owner/other")
        self.create_seer_project_repository(project=other, repository=other_repo)

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
            self.create_seer_project_repository(project=project, repository=repo)
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
        self.create_seer_project_repository(project=project, repository=repo)
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
            with patch(
                "sentry.tasks.seer.night_shift.cron.trigger_seer_feature",
                return_value=4242,
            ) as mock_trigger:
                run_night_shift_for_org(org.id)
        finally:
            redis_clusters.get("default").delete(skip_cache_key(skipped_group.id))

        mock_trigger.assert_called_once()
        request = mock_trigger.call_args.args[0]
        candidate_ids = [c["group_id"] for c in request["payload"]["candidates"]]
        assert candidate_ids == [other_group.id]

    def test_skips_dispatch_when_no_seer_quota(self) -> None:
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
            patch("sentry.tasks.seer.night_shift.cron.trigger_seer_feature") as mock_trigger,
        ):
            run_night_shift_for_org(org.id)
            mock_trigger.assert_not_called()

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.extras["error_message"] == "No Seer quota available"
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_max_candidates_defaults_to_global_option(self) -> None:
        org = self.create_organization()
        low = self.create_project(organization=org, slug="low")
        high = self.create_project(organization=org, slug="high")
        self._make_eligible(low, max_candidates=3)
        self._make_eligible(high, max_candidates=11)

        with patch(
            "sentry.tasks.seer.night_shift.cron.fixability_score_strategy",
            return_value=[],
        ) as mock_score:
            run_night_shift_for_org(org.id)

        mock_score.assert_called_once()
        assert mock_score.call_args.args[1] == 10

    def test_explicit_max_candidates_overrides_tweaks(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project, max_candidates=50)

        with patch(
            "sentry.tasks.seer.night_shift.cron.fixability_score_strategy",
            return_value=[],
        ) as mock_score:
            run_night_shift_for_org(org.id, options={"max_candidates": 7})

        mock_score.assert_called_once()
        assert mock_score.call_args.args[1] == 7

    def test_scheduler_skips_projects_with_tweaks_disabled(self) -> None:
        org = self.create_organization()
        enabled = self.create_project(organization=org, slug="on")
        disabled = self.create_project(organization=org, slug="off")
        self._make_eligible(enabled)
        self._make_eligible(disabled, enabled=False)

        with patch(
            "sentry.tasks.seer.night_shift.cron.fixability_score_strategy",
            return_value=[],
        ) as mock_score:
            run_night_shift_for_org(org.id)

        mock_score.assert_called_once()
        assert [p.id for p in mock_score.call_args.args[0]] == [enabled.id]


@django_db_all
class TestRunNightShiftFeatureDelivery(TestCase, SnubaTestCase):
    """Coverage for the dispatch path, which hands triage off to Seer's
    feature-run endpoint. Seer pushes verdicts back via deliver_feature_result."""

    reset_snuba_data = False

    def _make_eligible(self, project, **tweak_overrides):
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        repo = self.create_repo(project=project, provider="github", name=f"owner/{project.slug}")
        self.create_seer_project_repository(project=project, repository=repo)
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

    def test_dispatches_candidates_to_seer_feature(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        group = self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5, priority=75
        )

        with (
            patch(
                "sentry.tasks.seer.night_shift.cron.trigger_seer_feature",
                return_value=4242,
            ) as mock_trigger,
            patch("sentry.tasks.seer.night_shift.cron.trigger_autofix_agent") as mock_autofix,
        ):
            run_night_shift_for_org(org.id)

        # Autofix is fired by Seer's pushed-back verdicts, not in-process.
        mock_autofix.assert_not_called()

        mock_trigger.assert_called_once()
        request = mock_trigger.call_args.args[0]
        assert request["feature_id"] == "night_shift"
        assert [c["group_id"] for c in request["payload"]["candidates"]] == [group.id]
        assert request["payload"]["candidates"][0]["priority"] == "high"
        assert mock_trigger.call_args.kwargs["viewer_context"] == {"organization_id": org.id}

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.seer_run is not None
        assert request["ref"] == str(run.seer_run.uuid)
        assert run.extras["agent_run_id"] == 4242
        assert run.extras.get("error_message") is None
        # Verdicts and autofix are Seer's responsibility now; no result rows here.
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_no_candidates_skips_dispatch(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        with patch("sentry.tasks.seer.night_shift.cron.trigger_seer_feature") as mock_trigger:
            run_night_shift_for_org(org.id)

        mock_trigger.assert_not_called()
        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.seer_run is None

    def test_seer_feature_error_records_error_message(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with patch(
            "sentry.tasks.seer.night_shift.cron.trigger_seer_feature",
            side_effect=RuntimeError("seer down"),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.extras["error_message"] == "Night shift run failed"
        assert "agent_run_id" not in run.extras


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
        assert run.workflow_config is not None
        assert run.workflow_config.strategy == SeerWorkflowStrategy.AGENTIC_TRIAGE
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
        self.create_seer_project_repository(project=project, repository=repo)
        project.update_option("sentry:seer_nightshift_tweaks", {"enabled": False})

        with patch(
            "sentry.tasks.seer.night_shift.cron.fixability_score_strategy",
            return_value=[],
        ) as mock_score:
            run_night_shift_for_org(org.id, options={"source": "manual"}, project_ids=[project.id])

        mock_score.assert_called_once()
        assert [p.id for p in mock_score.call_args.args[0]] == [project.id]


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

    def test_ranks_scored_above_threshold_first_then_preserves_recommended_order(self) -> None:
        project = self.create_project()
        high = self._store_event_and_update_group(
            project, "high", seer_fixability_score=0.9, times_seen=5, priority=75
        )
        medium = self._store_event_and_update_group(
            project, "medium", seer_fixability_score=0.5, times_seen=50
        )
        self._store_event_and_update_group(
            project, "low", seer_fixability_score=0.2, times_seen=500
        )
        null = self._store_event_and_update_group(
            project, "null", seer_fixability_score=None, times_seen=100
        )

        result = fixability_score_strategy([project], max_candidates=10)

        result_ids = [c.group.id for c in result]

        assert result[0].group.id == high.id
        assert result[0].fixability == 0.9
        assert result[0].times_seen == 5
        assert medium.id in result_ids
        assert null.id in result_ids
        # Low-scored issue (below threshold) is excluded entirely
        assert len(result) == 3


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
