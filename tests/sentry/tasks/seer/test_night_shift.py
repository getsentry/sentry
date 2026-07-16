from unittest.mock import Mock, patch

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.issues.search import group_types_from
from sentry.models.group import Group
from sentry.models.organization import OrganizationStatus
from sentry.processing_errors.grouptype import LowValueSpanConfigurationType
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import AutofixStoppingPoint, bulk_read_preferences_from_sentry_db
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunResult,
    SeerNightShiftRunShard,
)
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.tasks.seer.night_shift.cron import (
    _get_eligible_projects,
    build_run_options,
    run_night_shift_for_org,
    schedule_night_shift,
)
from sentry.tasks.seer.night_shift.models import TriageAction
from sentry.tasks.seer.night_shift.simple_triage import (
    ScoredCandidate,
    fixability_score_strategy,
    fixability_score_strategy_per_project,
)
from sentry.tasks.seer.night_shift.skip_cache import key as skip_cache_key
from sentry.tasks.seer.night_shift.skip_cache import mark_skipped
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.fixtures import Fixtures
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.redis import redis_clusters


def _dispatched_feature_body(organization):
    seer_run = SeerRun.objects.get(organization=organization, type=SeerRunType.FEATURE_RUN)
    outbox = CellOutbox.objects.get(
        category=OutboxCategory.SEER_RUN_CREATE,
        object_identifier=seer_run.id,
    )
    assert outbox.payload is not None
    return seer_run, outbox.payload["body"]


class NightShiftFixtures(Fixtures):
    """Shared night-shift test setup. Mixed into the test cases below so the
    project-eligibility and event-seeding logic lives in one place."""

    def _make_eligible(
        self, project, *, stopping_point=AutofixStoppingPoint.OPEN_PR.value, **tweak_overrides
    ):
        """Configure a project to pass every eligibility gate: automation on, a
        connected repo, a PR-producing stopping point, and tweaks enabled.
        Override stopping_point (or pass enabled=False) to exercise one gate."""
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        project.update_option("sentry:seer_automated_run_stopping_point", stopping_point)
        repo = self.create_repo(project=project, provider="github", name=f"owner/{project.slug}")
        self.create_seer_project_repository(project=project, repository=repo)
        project.update_option("sentry:seer_nightshift_tweaks", {"enabled": True, **tweak_overrides})
        return project

    def _store_event_and_update_group(self, project, fingerprint, **group_attrs):
        event = self.store_event(
            data={
                "fingerprint": [fingerprint],
                "timestamp": before_now(hours=1).isoformat(),
                "environment": "production",
            },
            project_id=project.id,
        )
        assert event.group_id is not None
        Group.objects.filter(id=event.group_id).update(**group_attrs)
        return Group.objects.get(id=event.group_id)


@django_db_all
class TestBuildRunOptions(TestCase):
    """Precedence: manual_overrides > project tweaks > org overrides > defaults."""

    def test_defaults_only(self) -> None:
        with self.options({"seer.night_shift.issues_per_org": 8}):
            resolved = build_run_options(organization_id=self.organization.id)

        assert resolved["source"] == "cron"
        assert resolved["max_candidates"] == 8
        assert resolved["intelligence_level"] == "high"

    def test_org_overrides_apply_over_defaults(self) -> None:
        with self.options(
            {
                "seer.night_shift.issues_per_org": 8,
                "seer.night_shift.org_tweaks": {str(self.organization.id): {"max_candidates": 15}},
            }
        ):
            resolved = build_run_options(organization_id=self.organization.id)

        assert resolved["max_candidates"] == 15
        # Unset org fields fall through to the global default.
        assert resolved["intelligence_level"] == "high"

    def test_project_tweaks_override_org_overrides(self) -> None:
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:seer_nightshift_tweaks", {"intelligence_level": "low"})

        with self.options(
            {"seer.night_shift.org_tweaks": {str(self.organization.id): {"max_candidates": 15}}}
        ):
            resolved = build_run_options(
                organization_id=self.organization.id, project_id=project.id
            )

        # Project only set intelligence_level, so the org's max_candidates still
        # shows through (the project layer no longer clobbers it with a default).
        assert resolved["max_candidates"] == 15
        assert resolved["intelligence_level"] == "low"

    def test_manual_overrides_win(self) -> None:
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:seer_nightshift_tweaks", {"max_candidates": 25})

        with self.options(
            {"seer.night_shift.org_tweaks": {str(self.organization.id): {"max_candidates": 15}}}
        ):
            resolved = build_run_options(
                organization_id=self.organization.id,
                project_id=project.id,
                manual_overrides={"source": "manual", "max_candidates": 3},
            )

        assert resolved["source"] == "manual"
        assert resolved["max_candidates"] == 3


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

    def test_skips_orgs_with_code_generation_disabled(self) -> None:
        org = self.create_org_with_seer()
        org.update_option("sentry:enable_seer_coding", False)

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
class TestGetEligibleProjects(NightShiftFixtures, TestCase):
    def test_filters_by_automation_and_repos(self) -> None:
        org = self.create_organization()

        # Eligible on every gate.
        eligible = self._make_eligible(self.create_project(organization=org))

        # Automation off (even with a connected repo), and never given a
        # stopping point (defaults to code_changes, not open_pr) — fails two
        # gates at once, so the resulting log call should list both reasons.
        off = self.create_project(organization=org)
        off.update_option("sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF)
        off_repo = self.create_repo(project=off, provider="github", name="owner/off-repo")
        self.create_seer_project_repository(project=off, repository=off_repo)

        # No connected repo.
        self.create_project(organization=org)

        with patch("sentry.tasks.seer.night_shift.cron.logger") as mock_logger:
            result = _get_eligible_projects(org, "manual")

        assert [ep.project for ep in result] == [eligible]
        assert result[0].tweaks.enabled is True

        off_extra = next(
            call.kwargs["extra"]
            for call in mock_logger.info.call_args_list
            if call.kwargs["extra"]["project_id"] == off.id
        )
        assert off_extra["reasons"] == ["automation_tuning_off", "not_pr_producing"]

    def test_carries_each_projects_connected_repos(self) -> None:
        org = self.create_organization()
        a = self._make_eligible(self.create_project(organization=org, slug="a"))
        b = self._make_eligible(self.create_project(organization=org, slug="b"))
        extra = self.create_repo(project=b, provider="github", name="owner/b-extra")
        self.create_seer_project_repository(project=b, repository=extra)

        result = _get_eligible_projects(org, "manual")

        repos_by_slug = {ep.project.slug: sorted(ep.connected_repos) for ep in result}
        assert repos_by_slug[a.slug] == ["owner/a"]
        assert repos_by_slug[b.slug] == ["owner/b", "owner/b-extra"]

    def test_filters_by_project_id(self) -> None:
        org = self.create_organization()
        target = self._make_eligible(self.create_project(organization=org))
        self._make_eligible(self.create_project(organization=org))

        result = _get_eligible_projects(org, "manual", project_ids=[target.id])

        assert [ep.project for ep in result] == [target]

    def test_cron_filters_disabled_tweaks_manual_keeps_them(self) -> None:
        org = self.create_organization()
        for slug, enabled in (("on", True), ("off", False)):
            self._make_eligible(self.create_project(organization=org, slug=slug), enabled=enabled)

        cron_result = _get_eligible_projects(org, "cron")
        manual_result = _get_eligible_projects(org, "manual")

        assert [ep.project.slug for ep in cron_result] == ["on"]
        assert sorted(ep.project.slug for ep in manual_result) == ["off", "on"]

    def test_drops_projects_that_cannot_open_prs(self) -> None:
        org = self.create_organization()
        opens_pr = self._make_eligible(
            self.create_project(organization=org),
            stopping_point=AutofixStoppingPoint.OPEN_PR.value,
        )
        self._make_eligible(
            self.create_project(organization=org),
            stopping_point=AutofixStoppingPoint.CODE_CHANGES.value,
        )
        self._make_eligible(
            self.create_project(organization=org),
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE.value,
        )

        result = _get_eligible_projects(org, "manual")

        assert [ep.project for ep in result] == [opens_pr]

    def test_cron_respects_org_allowed_project_slugs_manual_ignores(self) -> None:
        org = self.create_organization()
        for slug in ("keep", "drop"):
            self._make_eligible(self.create_project(organization=org, slug=slug))

        with self.options(
            {"seer.night_shift.org_tweaks": {str(org.id): {"allowed_project_slugs": ["keep"]}}}
        ):
            cron_result = _get_eligible_projects(org, "cron")
            manual_result = _get_eligible_projects(org, "manual")

        assert [ep.project.slug for ep in cron_result] == ["keep"]
        assert sorted(ep.project.slug for ep in manual_result) == ["drop", "keep"]

    def test_skips_project_missing_from_preferences_lookup(self) -> None:
        """project_map and preferences come from separate queries, so a
        project absent from the preferences result (e.g. deleted in the gap
        between the two queries) must be skipped, not raise a KeyError."""
        org = self.create_organization()
        present = self._make_eligible(self.create_project(organization=org))
        missing = self._make_eligible(self.create_project(organization=org))

        real_preferences = bulk_read_preferences_from_sentry_db(org.id, [present.id, missing.id])
        stale_preferences = {
            pid: pref for pid, pref in real_preferences.items() if pid != missing.id
        }

        with patch(
            "sentry.tasks.seer.night_shift.cron.bulk_read_preferences_from_sentry_db",
            return_value=stale_preferences,
        ):
            result = _get_eligible_projects(org, "manual")

        assert [ep.project for ep in result] == [present]


@django_db_all
class TestRunNightShiftForOrg(NightShiftFixtures, TestCase, SnubaTestCase):
    reset_snuba_data = False

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
            with self.feature("organizations:gen-ai-features"):
                run_night_shift_for_org(org.id)
        finally:
            redis_clusters.get("default").delete(skip_cache_key(skipped_group.id))

        _, body = _dispatched_feature_body(org)
        candidate_ids = [c["group_id"] for c in body["payload"]["candidates"]]
        assert candidate_ids == [other_group.id]

    def test_skips_dispatch_when_no_seer_quota(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with patch(
            "sentry.tasks.seer.night_shift.cron.quotas.backend.check_seer_quota",
            return_value=False,
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert run.extras["error_message"] == "No Seer quota available"
        assert not SeerRun.objects.filter(organization=org).exists()
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

    def test_org_tweaks_override_global_default(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project, max_candidates=50)

        with (
            self.options({"seer.night_shift.org_tweaks": {str(org.id): {"max_candidates": 25}}}),
            patch(
                "sentry.tasks.seer.night_shift.cron.fixability_score_strategy",
                return_value=[],
            ) as mock_score,
        ):
            run_night_shift_for_org(org.id)

        mock_score.assert_called_once()
        assert mock_score.call_args.args[1] == 25

    def test_explicit_options_override_org_tweaks(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project, max_candidates=50)

        with (
            self.options({"seer.night_shift.org_tweaks": {str(org.id): {"max_candidates": 25}}}),
            patch(
                "sentry.tasks.seer.night_shift.cron.fixability_score_strategy",
                return_value=[],
            ) as mock_score,
        ):
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
class TestRunNightShiftFeatureDelivery(NightShiftFixtures, TestCase, SnubaTestCase):
    """Coverage for the dispatch path, which hands triage off to Seer's
    feature-run endpoint. Seer pushes verdicts back via deliver_feature_result."""

    reset_snuba_data = False

    def _shard_group_ids(self, shard):
        outbox = CellOutbox.objects.get(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=shard.seer_run_id
        )
        assert outbox.payload is not None
        return [c["group_id"] for c in outbox.payload["body"]["payload"]["candidates"]]

    def test_chunking_preserves_order_across_even_shards(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)
        groups = [self.create_group(project=project) for _ in range(4)]
        scored = [ScoredCandidate(group=g, fixability=0.9) for g in groups]

        with (
            self.options({"seer.night_shift.shard_size": 2}),
            self.feature("organizations:gen-ai-features"),
            patch(
                "sentry.tasks.seer.night_shift.cron.fixability_score_strategy",
                return_value=scored,
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        shards = list(SeerNightShiftRunShard.objects.filter(run=run).order_by("id"))
        # 4 candidates @ size 2 -> two even shards, fixability order preserved.
        assert [self._shard_group_ids(s) for s in shards] == [
            [groups[0].id, groups[1].id],
            [groups[2].id, groups[3].id],
        ]

    def test_chunking_single_shard_when_size_exceeds_count(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)
        groups = [self.create_group(project=project) for _ in range(3)]
        scored = [ScoredCandidate(group=g, fixability=0.9) for g in groups]

        with (
            self.options({"seer.night_shift.shard_size": 10}),
            self.feature("organizations:gen-ai-features"),
            patch(
                "sentry.tasks.seer.night_shift.cron.fixability_score_strategy",
                return_value=scored,
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        shards = list(SeerNightShiftRunShard.objects.filter(run=run))
        assert len(shards) == 1
        assert self._shard_group_ids(shards[0]) == [g.id for g in groups]

    def test_non_positive_shard_size_clamps_to_one(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)
        groups = [self.create_group(project=project) for _ in range(3)]
        scored = [ScoredCandidate(group=g, fixability=0.9) for g in groups]

        with (
            self.options({"seer.night_shift.shard_size": 0}),
            self.feature("organizations:gen-ai-features"),
            patch(
                "sentry.tasks.seer.night_shift.cron.fixability_score_strategy",
                return_value=scored,
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        shards = list(SeerNightShiftRunShard.objects.filter(run=run))
        assert len(shards) == 3

    def test_dispatches_candidates_to_seer_feature(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        group = self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5, priority=75
        )

        with (
            self.feature("organizations:gen-ai-features"),
            patch("sentry.seer.night_shift.delivery.trigger_autofix_agent") as mock_autofix,
        ):
            run_night_shift_for_org(org.id)

        # Autofix is fired by Seer's pushed-back verdicts, not in-process.
        mock_autofix.assert_not_called()

        run = SeerNightShiftRun.objects.get(organization=org)
        shard = run.shards.get()

        seer_run, body = _dispatched_feature_body(org)
        assert seer_run.id == shard.seer_run_id
        assert seer_run.type == SeerRunType.FEATURE_RUN
        assert body["feature_id"] == "night_shift"
        assert [c["group_id"] for c in body["payload"]["candidates"]] == [group.id]
        assert body["payload"]["candidates"][0]["priority"] == "high"
        assert body["payload"]["candidates"][0]["connected_repos"] == [f"owner/{project.slug}"]

        outbox = CellOutbox.objects.get(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=seer_run.id
        )
        assert outbox.payload is not None
        assert outbox.payload["viewer_context"] == {"organization_id": org.id}

        assert seer_run.mirror_status == SeerRunMirrorStatus.PENDING
        assert seer_run.seer_run_state_id is None
        assert run.extras.get("error_message") is None
        # Verdicts and autofix are Seer's responsibility now; no result rows here.
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_allowed_project_slugs_gives_each_project_its_own_quota(self) -> None:
        org = self.create_organization()
        noisy = self._make_eligible(self.create_project(organization=org, slug="noisy"))
        quiet = self._make_eligible(self.create_project(organization=org, slug="quiet"))

        for i in range(3):
            self._store_event_and_update_group(
                noisy, f"noisy-{i}", seer_fixability_score=0.9, times_seen=5
            )
        quiet_issue = self._store_event_and_update_group(
            quiet, "quiet-issue", seer_fixability_score=0.5, times_seen=1
        )

        with (
            self.feature("organizations:gen-ai-features"),
            self.options(
                {
                    "seer.night_shift.org_tweaks": {
                        str(org.id): {
                            "max_candidates": 1,
                            "allowed_project_slugs": ["noisy", "quiet"],
                        }
                    }
                }
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        shard = run.shards.get()
        candidate_group_ids = self._shard_group_ids(shard)

        # max_candidates=1 would only leave room for one of noisy's higher-scored
        # issues under the combined strategy; per-project quotas give quiet a
        # guaranteed slot too.
        assert len(candidate_group_ids) == 2
        assert quiet_issue.id in candidate_group_ids

    def test_shards_candidates_across_feature_runs(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        groups = [
            self._store_event_and_update_group(
                project, f"fixable-{i}", seer_fixability_score=0.9, times_seen=5 + i
            )
            for i in range(3)
        ]

        with (
            self.options({"seer.night_shift.shard_size": 2}),
            self.feature("organizations:gen-ai-features"),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        # 3 candidates, shard size 2 -> 2 shards (2 + 1).
        shards = list(SeerNightShiftRunShard.objects.filter(run=run).order_by("id"))
        assert len(shards) == 2
        assert SeerRun.objects.filter(organization=org, type=SeerRunType.FEATURE_RUN).count() == 2

        shard_sizes = []
        dispatched_group_ids: list[int] = []
        for shard in shards:
            outbox = CellOutbox.objects.get(
                category=OutboxCategory.SEER_RUN_CREATE, object_identifier=shard.seer_run_id
            )
            assert outbox.payload is not None
            candidates = outbox.payload["body"]["payload"]["candidates"]
            shard_sizes.append(len(candidates))
            dispatched_group_ids.extend(c["group_id"] for c in candidates)

        assert sorted(shard_sizes) == [1, 2]
        assert sorted(dispatched_group_ids) == sorted(g.id for g in groups)
        assert run.extras.get("error_message") is None

    def test_partial_shard_failure_still_dispatches(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)
        for i in range(2):
            self._store_event_and_update_group(
                project, f"fixable-{i}", seer_fixability_score=0.9, times_seen=5 + i
            )

        real_create = SeerNightShiftRunShard.objects.create
        calls: list[int] = []

        def flaky_create(*args, **kwargs):
            calls.append(1)
            if len(calls) == 2:
                raise RuntimeError("boom")
            return real_create(*args, **kwargs)

        with (
            self.options({"seer.night_shift.shard_size": 1}),
            self.feature("organizations:gen-ai-features"),
            patch.object(SeerNightShiftRunShard.objects, "create", side_effect=flaky_create),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        # One shard dispatched; the failed one is recorded so it isn't invisible.
        assert SeerNightShiftRunShard.objects.filter(run=run).count() == 1
        assert SeerRun.objects.filter(organization=org, type=SeerRunType.FEATURE_RUN).count() == 1
        assert run.extras["error_message"] == "Failed to dispatch 1 of 2 triage shards"

    def test_no_candidates_skips_dispatch(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)

        run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert not run.shards.exists()
        # No SeerRun for the org -> no outbox either (created in one transaction).
        assert not SeerRun.objects.filter(organization=org).exists()

    def test_no_seer_access_skips_dispatch(self) -> None:
        # Without gen-ai-features the SeerAgentClient access gate blocks dispatch.
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)
        self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert not run.shards.exists()
        assert run.extras["error_message"] == "Organization does not have Seer access"
        assert not SeerRun.objects.filter(organization=org).exists()

    def test_dispatch_failure_records_error(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)
        self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with (
            self.feature("organizations:gen-ai-features"),
            patch(
                "sentry.seer.agent.client.SeerAgentClient.start_feature_run",
                side_effect=RuntimeError("boom"),
            ),
        ):
            run_night_shift_for_org(org.id)

        run = SeerNightShiftRun.objects.get(organization=org)
        assert not run.shards.exists()
        assert run.extras["error_message"] == "Night shift dispatch failed"

    def test_outbox_drain_mirrors_run_against_seer(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self._make_eligible(project)
        self._store_event_and_update_group(
            project, "fixable", seer_fixability_score=0.9, times_seen=5
        )

        with self.feature("organizations:gen-ai-features"):
            run_night_shift_for_org(org.id)

        seer_run = SeerRun.objects.get(organization=org, type=SeerRunType.FEATURE_RUN)
        assert seer_run.mirror_status == SeerRunMirrorStatus.PENDING

        with patch(
            "sentry.receivers.outbox.cell.make_feature_run_request",
            return_value=Mock(status=200, json=Mock(return_value={"run_id": 4242})),
        ) as mock_request:
            with outbox_runner():
                pass

        mock_request.assert_called_once()
        sent_body = mock_request.call_args.args[0]
        assert sent_body["feature_id"] == "night_shift"
        assert sent_body["external_idempotency_key"] == str(seer_run.uuid)

        seer_run.refresh_from_db()
        assert seer_run.seer_run_state_id == 4242
        assert seer_run.mirror_status == SeerRunMirrorStatus.LIVE


@django_db_all
class TestRunNightShiftForOrgManualPath(NightShiftFixtures, TestCase):
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
            "num_eligible_projects": 0,
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
        project = self._make_eligible(self.create_project(organization=org), enabled=False)

        with patch(
            "sentry.tasks.seer.night_shift.cron.fixability_score_strategy",
            return_value=[],
        ) as mock_score:
            run_night_shift_for_org(org.id, options={"source": "manual"}, project_ids=[project.id])

        mock_score.assert_called_once()
        assert [p.id for p in mock_score.call_args.args[0]] == [project.id]


@django_db_all
class TestFixabilityScoreStrategy(NightShiftFixtures, TestCase, SnubaTestCase):
    reset_snuba_data = False

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

    def test_includes_low_value_span_issues_in_search(self) -> None:
        project = self.create_project()
        error_group = self.create_group(project=project)
        lvs_group = self.create_group(project=project, type=LowValueSpanConfigurationType.type_id)

        with patch(
            "sentry.tasks.seer.night_shift.simple_triage.search.backend.query"
        ) as mock_query:
            mock_query.return_value = Mock(results=[error_group, lvs_group])
            result = fixability_score_strategy([project], max_candidates=10)

        assert {c.group.id for c in result} == {error_group.id, lvs_group.id}

        mock_query.assert_called_once()
        type_filters = [
            sf
            for sf in mock_query.call_args.kwargs["search_filters"]
            if sf.key.name == "issue.type"
        ]
        assert len(type_filters) == 1
        # The default type set is widened to include low-value-span, not replaced by it.
        assert set(type_filters[0].value.raw_value) == group_types_from([]) | {
            LowValueSpanConfigurationType.type_id
        }

    def test_per_project_fetch_limit_scales_with_max_candidates(self) -> None:
        project = self.create_project()

        with patch(
            "sentry.tasks.seer.night_shift.simple_triage.search.backend.query"
        ) as mock_query:
            mock_query.return_value = Mock(results=[])
            fixability_score_strategy_per_project([project], max_candidates=5)

        assert mock_query.call_args.kwargs["limit"] == 15

    def test_per_project_fetch_limit_caps_at_global_fetch_limit(self) -> None:
        project = self.create_project()

        with patch(
            "sentry.tasks.seer.night_shift.simple_triage.search.backend.query"
        ) as mock_query:
            mock_query.return_value = Mock(results=[])
            fixability_score_strategy_per_project([project], max_candidates=40)

        assert mock_query.call_args.kwargs["limit"] == 100


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
