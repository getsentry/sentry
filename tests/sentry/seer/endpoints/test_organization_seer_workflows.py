from datetime import timedelta
from unittest.mock import patch

import pytest
from django.test import override_settings
from django.utils import timezone

from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunErrorType,
    SeerNightShiftRunResult,
    SeerNightShiftRunShard,
)
from sentry.seer.models.run import SeerRunPullRequest
from sentry.seer.monitor_cleanup import (
    FEATURE,
    MonitorCleanupArtifact,
    OrganizationMonitorCleanupArtifact,
    prepare_monitor_cleanup_results,
    validate_monitor_cleanup,
)
from sentry.tasks.seer.monitor_cleanup import (
    collect_monitor_cleanup_result,
    dispatch_run,
    finish_shard,
    reconcile_run,
    scan_organization,
)
from sentry.testutils.cases import APITestCase


class OrganizationSeerWorkflowsTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflows"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_feature_flag_disabled_returns_404(self) -> None:
        SeerNightShiftRun.objects.create(organization=self.organization)
        self.get_error_response(self.organization.slug, status_code=404)

    def test_returns_runs_for_org_with_nested_results(self) -> None:
        group = self.create_group()
        run = SeerNightShiftRun.objects.create(
            organization=self.organization,
            extras={"foo": "bar", "agent_run_id": "seer-legacy-dispatch"},
        )
        result = SeerNightShiftRunResult.objects.create(
            run=run,
            kind="agentic_triage",
            group=group,
            seer_run_id="seer-123",
            extras={"action": "autofix_triggered", "reason": "Null pointer in the checkout flow"},
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(run.id)
        assert response.data[0]["errorMessage"] is None
        assert response.data[0]["errorType"] is None
        assert response.data[0]["extras"] == {"foo": "bar"}
        assert len(response.data[0]["results"]) == 1

        result_data = response.data[0]["results"][0]
        assert result_data["id"] == str(result.id)
        assert result_data["kind"] == "agentic_triage"
        assert result_data["groupId"] == str(group.id)
        assert result_data["seerRunId"] is None
        assert result_data["extras"] == {
            "action": "autofix_triggered",
            "reason": "Null pointer in the checkout flow",
        }

        # Transitional aliases for the existing frontend.
        assert response.data[0]["triageStrategy"] == "agentic_triage"
        assert len(response.data[0]["issues"]) == 1
        issue = response.data[0]["issues"][0]
        assert issue["seerRunId"] is None
        assert issue["groupId"] == str(group.id)
        assert issue["groupTitle"] == group.title
        assert issue["groupShortId"] == group.qualified_short_id
        assert issue["action"] == "autofix_triggered"
        assert issue["reason"] == "Null pointer in the checkout flow"
        # No result_seer_run FK is set on this result, so no PRs resolve.
        assert issue["pullRequests"] == []

    def test_skip_reason_surfaces_on_issue(self) -> None:
        group = self.create_group()
        run = SeerNightShiftRun.objects.create(organization=self.organization)
        SeerNightShiftRunResult.objects.create(
            run=run,
            kind="agentic_triage",
            group=group,
            extras={
                "action": "skip",
                "reason": "plausible root cause but not confident",
                "skip_reason": "ambiguous_root_cause",
            },
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        issue = response.data[0]["issues"][0]
        assert issue["action"] == "skip"
        assert issue["skipReason"] == "ambiguous_root_cause"

    def test_issue_with_missing_group_has_null_title(self) -> None:
        # group FK is db_constraint=False, so a stale group_id is possible in
        # prod; can't use create+delete since Django still cascades that.
        run = SeerNightShiftRun.objects.create(organization=self.organization)
        SeerNightShiftRunResult.objects.create(
            run=run,
            kind="agentic_triage",
            group_id=999999999,
            extras={"action": "skip"},
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        issue = response.data[0]["issues"][0]
        assert issue["groupTitle"] is None
        assert issue["groupShortId"] is None
        assert issue["pullRequests"] == []

    def test_issue_includes_pull_requests_via_result_seer_run_fk(self) -> None:
        group = self.create_group()
        repo = self.create_repo()
        pull_request = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id
        )
        issue_seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=123456
        )
        SeerRunPullRequest.objects.create(seer_run=issue_seer_run, pull_request=pull_request)

        run = SeerNightShiftRun.objects.create(organization=self.organization)
        SeerNightShiftRunResult.objects.create(
            run=run,
            kind="agentic_triage",
            group=group,
            result_seer_run=issue_seer_run,
            extras={"action": "autofix_triggered"},
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        issue = response.data[0]["issues"][0]
        assert issue["seerRunId"] == str(issue_seer_run.uuid)
        assert response.data[0]["results"][0]["seerRunId"] == str(issue_seer_run.uuid)
        assert len(issue["pullRequests"]) == 1
        assert issue["pullRequests"][0]["id"] == pull_request.key
        assert issue["pullRequests"][0]["title"] == pull_request.title
        # No webhook event observed for this PR, so status is unknown.
        assert issue["pullRequests"][0]["status"] is None

    def test_issue_pull_request_status_reflects_merged_state(self) -> None:
        group = self.create_group()
        repo = self.create_repo()
        pull_request = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id
        )
        pull_request.update(state=PullRequestLifecycleState.MERGED)
        issue_seer_run = self.create_seer_run(organization=self.organization)
        SeerRunPullRequest.objects.create(seer_run=issue_seer_run, pull_request=pull_request)

        run = SeerNightShiftRun.objects.create(organization=self.organization)
        SeerNightShiftRunResult.objects.create(
            run=run,
            kind="agentic_triage",
            group=group,
            result_seer_run=issue_seer_run,
            extras={"action": "autofix_triggered"},
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        issue = response.data[0]["issues"][0]
        assert issue["pullRequests"][0]["status"] == "merged"

    def test_issue_with_only_legacy_seer_run_id_has_no_pull_requests(self) -> None:
        # result_seer_run has no backfill migration, so rows predating it only
        # have the legacy text seer_run_id -- PRs are intentionally not
        # resolved for those, even if a SeerRun with a matching
        # seer_run_state_id exists.
        group = self.create_group()
        repo = self.create_repo()
        pull_request = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id
        )
        issue_seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=999)
        SeerRunPullRequest.objects.create(seer_run=issue_seer_run, pull_request=pull_request)

        run = SeerNightShiftRun.objects.create(organization=self.organization)
        SeerNightShiftRunResult.objects.create(
            run=run,
            kind="agentic_triage",
            group=group,
            seer_run_id="999",
            extras={"action": "autofix_triggered"},
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        issue = response.data[0]["issues"][0]
        assert issue["pullRequests"] == []
        assert issue["seerRunId"] is None
        assert response.data[0]["results"][0]["seerRunId"] is None

    def test_pull_requests_not_leaked_across_runs(self) -> None:
        group_a = self.create_group()
        group_b = self.create_group()
        repo = self.create_repo()
        pull_request = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id
        )
        seer_run_a = self.create_seer_run(organization=self.organization)
        SeerRunPullRequest.objects.create(seer_run=seer_run_a, pull_request=pull_request)

        run_a = SeerNightShiftRun.objects.create(organization=self.organization)
        SeerNightShiftRunResult.objects.create(
            run=run_a,
            kind="agentic_triage",
            group=group_a,
            result_seer_run=seer_run_a,
            extras={"action": "autofix_triggered"},
        )
        run_b = SeerNightShiftRun.objects.create(organization=self.organization)
        SeerNightShiftRunResult.objects.create(
            run=run_b,
            kind="agentic_triage",
            group=group_b,
            extras={"action": "skip"},
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        by_run_id = {r["id"]: r for r in response.data}
        assert len(by_run_id[str(run_a.id)]["issues"][0]["pullRequests"]) == 1
        assert by_run_id[str(run_b.id)]["issues"][0]["pullRequests"] == []

    def test_surfaces_shard_uuids_without_state_ids(self) -> None:
        run = SeerNightShiftRun.objects.create(organization=self.organization)
        seer_run_a = self.create_seer_run(organization=self.organization, seer_run_state_id=111)
        seer_run_b = self.create_seer_run(organization=self.organization, seer_run_state_id=222)
        SeerNightShiftRunShard.objects.create(run=run, seer_run=seer_run_a)
        SeerNightShiftRunShard.objects.create(run=run, seer_run=seer_run_b)
        pending_run = self.create_seer_run(organization=self.organization, seer_run_state_id=None)
        SeerNightShiftRunShard.objects.create(run=run, seer_run=pending_run)
        SeerNightShiftRunShard.objects.create(run=run)

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        seer_run_ids = [r["seerRunId"] for r in response.data[0]["seerRuns"]]
        assert seer_run_ids == [
            str(seer_run_a.uuid),
            str(seer_run_b.uuid),
            str(pending_run.uuid),
            None,
        ]

    def test_surfaces_shard_error_message(self) -> None:
        # Per-shard delivery errors live on the shard; the run API must still
        # surface them so a failed shard doesn't read as a healthy run.
        run = SeerNightShiftRun.objects.create(organization=self.organization)
        SeerNightShiftRunShard.objects.create(run=run)
        SeerNightShiftRunShard.objects.create(
            run=run,
            extras={
                "error_type": SeerNightShiftRunErrorType.SHARD_DELIVERY_FAILED.value,
                "error_message": "shard failed",
            },
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        assert response.data[0]["errorMessage"] == "shard failed"
        assert response.data[0]["errorType"] == "shard_delivery_failed"

    def test_returns_structured_error_type(self) -> None:
        run = SeerNightShiftRun.objects.create(
            organization=self.organization,
            extras={
                "error_type": SeerNightShiftRunErrorType.NO_QUOTA.value,
                "error_message": "Diagnostic details",
            },
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        assert response.data[0]["id"] == str(run.id)
        assert response.data[0]["errorMessage"] == "Diagnostic details"
        assert response.data[0]["errorType"] == "no_quota"

    def test_derives_error_types_for_legacy_messages(self) -> None:
        dispatch_run = SeerNightShiftRun.objects.create(
            organization=self.organization,
            extras={"error_message": "Failed to dispatch 1 of 3 triage shards"},
        )
        no_access_run = SeerNightShiftRun.objects.create(
            organization=self.organization,
            extras={"error_message": "Organization does not have Seer access"},
        )
        unknown_run = SeerNightShiftRun.objects.create(
            organization=self.organization,
            extras={"error_message": "Unexpected error"},
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        by_run_id = {item["id"]: item for item in response.data}
        assert by_run_id[str(dispatch_run.id)]["errorType"] == "shard_dispatch_failed"
        assert by_run_id[str(no_access_run.id)]["errorType"] == "no_seer_access"
        assert by_run_id[str(unknown_run.id)]["errorType"] == "unknown"

    def test_runs_ordered_by_date_added_desc(self) -> None:
        older = SeerNightShiftRun.objects.create(organization=self.organization)
        newer = SeerNightShiftRun.objects.create(organization=self.organization)

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        assert [r["id"] for r in response.data] == [str(newer.id), str(older.id)]

    def test_runs_scoped_to_requesting_org(self) -> None:
        other_org = self.create_organization()
        SeerNightShiftRun.objects.create(organization=other_org)
        own_run = SeerNightShiftRun.objects.create(organization=self.organization)

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(own_run.id)


class OrganizationSeerMonitorCleanupTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflows"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.keep = self.create_detector(project=self.project, type="metric_issue", name="Keep")
        self.duplicate = self.create_detector(
            project=self.project, type="metric_issue", name="Copy"
        )
        self.login_as(self.user)

    def trigger(self):
        with (
            self.feature(FEATURE),
            patch("sentry.tasks.seer.monitor_cleanup.dispatch_run"),
            self.tasks(),
        ):
            return self.get_success_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=202
            )

    def artifact(self, duplicate_id: str | None = None):
        return MonitorCleanupArtifact(
            scan_status="complete",
            monitors_scanned=2,
            summary="One duplicate group",
            groups=[
                {
                    "suggested_keep_id": str(self.keep.id),
                    "duplicate_ids": [duplicate_id or str(self.duplicate.id)],
                    "reason": "Matching configuration",
                    "matching_settings": [{"label": "Trigger", "value": "More than 100 errors"}],
                }
            ],
        )

    def organization_artifact(self):
        return OrganizationMonitorCleanupArtifact(
            scan_status="complete",
            projects=[{"project_id": str(self.project.id), **self.artifact().dict()}],
        )

    def test_starts_one_agent_for_all_projects(self) -> None:
        for _ in range(21):
            project = self.create_project(organization=self.organization)
            self.create_detector(project=project, type="metric_issue")
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        assert run.shards.count() == 1
        with (
            self.feature(FEATURE),
            patch("sentry.tasks.seer.monitor_cleanup.SeerAgentClient") as client,
        ):
            scan_organization(run.shards.get().id)
        client.assert_called_once()
        assert "project" not in client.call_args.kwargs
        client.return_value.start_run.assert_called_once()
        args = client.return_value.start_run.call_args
        assert args.kwargs["artifact_schema"] is OrganizationMonitorCleanupArtifact
        assert args.kwargs["metadata"] == {"workflow_run_id": run.id}
        assert "Discover the projects accessible to the current user" in args.kwargs["prompt"]

    def test_dispatch_queues_one_scan(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        with (
            patch("sentry.tasks.seer.monitor_cleanup.scan_organization.apply_async") as enqueue,
            patch("sentry.tasks.seer.monitor_cleanup.reconcile_run.apply_async"),
        ):
            dispatch_run(run.id)
        enqueue.assert_called_once_with(args=[run.shards.get().id])

    def test_one_scan_persists_results_from_multiple_projects(self) -> None:
        other_project = self.create_project(organization=self.organization)
        artifact = self.organization_artifact()
        artifact.projects.append(
            artifact.projects[0].copy(
                update={"project_id": str(other_project.id), "groups": [], "monitors_scanned": 1}
            )
        )
        outputs = prepare_monitor_cleanup_results(artifact, self.organization, self.user.id)
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        shard = run.shards.get()
        shard.update(seer_run=seer_run)
        finish_shard(shard.id, outputs=outputs)
        assert run.results.count() == 2
        assert set(run.results.values_list("result_seer_run_id", flat=True)) == {seer_run.id}
        assert {result.extras["projectSlug"] for result in run.results.all()} == {
            self.project.slug,
            other_project.slug,
        }
        run.refresh_from_db()
        assert run.extras["status"] == "complete"

    def test_empty_scan_completes(self) -> None:
        artifact = OrganizationMonitorCleanupArtifact(scan_status="complete", projects=[])
        outputs = prepare_monitor_cleanup_results(artifact, self.organization, self.user.id)
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        finish_shard(run.shards.get().id, outputs=outputs)
        run.refresh_from_db()
        assert run.extras["status"] == "complete"
        assert not run.results.exists()

    def test_partial_discovery_stays_partial(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        finish_shard(run.shards.get().id, outputs=[], scan_status="partial")
        run.refresh_from_db()
        assert run.extras["status"] == "partial"
        assert run.date_completed is not None

    def test_rejects_inaccessible_result_projects(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        with pytest.raises(ValueError, match="no longer accessible"):
            prepare_monitor_cleanup_results(
                self.organization_artifact(), self.organization, member.id
            )

    def test_rejects_foreign_result_projects(self) -> None:
        artifact = self.organization_artifact()
        foreign = self.create_project(organization=self.create_organization())
        artifact.projects[0].project_id = str(foreign.id)
        with pytest.raises(ValueError, match="no longer accessible"):
            prepare_monitor_cleanup_results(artifact, self.organization, self.user.id)

    def test_trigger_creates_manual_run_and_shard(self) -> None:
        response = self.trigger()
        run = SeerNightShiftRun.objects.get(id=response.data["runId"])
        assert run.schedule_id is None
        assert run.extras["triggering_user_id"] == self.user.id
        assert run.workflow_config is not None
        assert run.workflow_config.strategy == "duplicate_monitors"
        assert run.workflow_config.enabled is False
        assert run.shards.get().extras == {"status": "queued"}
        assert f"runId={run.id}" in response.data["url"]

    def test_rejects_concurrent_scan(self) -> None:
        self.trigger()
        with self.feature(FEATURE):
            response = self.get_error_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=400
            )
        assert response.data["detail"] == "A monitor scan is already running."
        assert SeerNightShiftRun.objects.filter(organization=self.organization).count() == 1

    def test_allows_scan_after_previous_run_completes(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        finish_shard(run.shards.get().id, error="Scan failed")
        assert self.trigger().data["runId"] != str(run.id)

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_rate_limits_repeated_triggers(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        finish_shard(run.shards.get().id, error="Scan failed")
        with self.feature(FEATURE):
            self.get_error_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=429
            )
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/"
            )
        assert response.status_code == 200
        assert SeerNightShiftRun.objects.filter(organization=self.organization).count() == 1

    def test_limits_scans_per_organization_per_hour(self) -> None:
        for _ in range(5):
            run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
            finish_shard(run.shards.get().id, error="Scan failed")
        another_user = self.create_user()
        self.create_member(organization=self.organization, user=another_user, role="owner")
        self.login_as(another_user)
        with self.feature(FEATURE):
            response = self.get_error_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=429
            )
        assert "five scans per hour" in response.data["detail"]
        SeerNightShiftRun.objects.filter(organization=self.organization).update(
            date_added=timezone.now() - timedelta(hours=2)
        )
        self.trigger()
        assert SeerNightShiftRun.objects.filter(organization=self.organization).count() == 6

    def test_rejects_run_id_above_bigint_range(self) -> None:
        with self.feature(FEATURE):
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/",
                {"runId": "9223372036854775808"},
            )
        assert response.status_code == 400

    def test_accepts_run_id_at_bigint_limit(self) -> None:
        with self.feature(FEATURE):
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/",
                {"runId": "9223372036854775807"},
            )
        assert response.status_code == 200
        assert response.data == []

    def test_tasks_ignore_deleted_run(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        run_id = run.id
        shard_id = run.shards.get().id
        run.delete()
        with (
            patch("sentry.tasks.seer.monitor_cleanup.SeerAgentClient") as client,
            patch(
                "sentry.tasks.seer.monitor_cleanup.scan_organization.apply_async"
            ) as enqueue_scan,
            patch("sentry.tasks.seer.monitor_cleanup.reconcile_run.apply_async") as enqueue_poll,
        ):
            scan_organization(shard_id)
            finish_shard(shard_id, error="Late failure")
            reconcile_run(run_id)
            dispatch_run(run_id)
        client.assert_not_called()
        enqueue_scan.assert_not_called()
        enqueue_poll.assert_not_called()

    def test_reconcile_schedules_next_poll_before_fetching_results(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        run.shards.get().update(seer_run=seer_run)
        with (
            patch("sentry.tasks.seer.monitor_cleanup.reconcile_run.apply_async") as enqueue_poll,
            patch(
                "sentry.tasks.seer.monitor_cleanup.collect_monitor_cleanup_result",
                side_effect=KeyboardInterrupt,
            ),
            pytest.raises(KeyboardInterrupt),
        ):
            reconcile_run(run.id)
        enqueue_poll.assert_called_once_with(args=[run.id], countdown=120)

    def test_reconcile_times_out_without_fetching_results(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        run.update(date_added=timezone.now() - timedelta(minutes=16))
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        run.shards.get().update(seer_run=seer_run)
        with (
            patch("sentry.tasks.seer.monitor_cleanup.reconcile_run.apply_async"),
            patch("sentry.tasks.seer.monitor_cleanup.collect_monitor_cleanup_result") as collect,
        ):
            reconcile_run(run.id)
        collect.assert_not_called()
        run.refresh_from_db()
        assert run.extras["status"] == "failed"
        assert run.date_completed is not None

    def test_requires_feature(self) -> None:
        self.get_error_response(
            self.organization.slug, strategy="duplicate_monitors", status_code=404
        )

    def test_rejects_unknown_strategy(self) -> None:
        with self.feature(FEATURE):
            response = self.get_error_response(
                self.organization.slug, strategy="unknown", status_code=400
            )
        assert "strategy" in response.data["detail"]
        assert not SeerNightShiftRun.objects.filter(organization=self.organization).exists()

    def test_rejects_strategy_without_manual_handler(self) -> None:
        with self.feature(FEATURE):
            response = self.get_error_response(
                self.organization.slug, strategy="agentic_triage", status_code=400
            )
        assert "strategy" in response.data["detail"]
        assert not SeerNightShiftRun.objects.filter(organization=self.organization).exists()

    def test_requires_strategy(self) -> None:
        with self.feature(FEATURE):
            response = self.get_error_response(self.organization.slug, status_code=400)
        assert "strategy" in response.data["detail"]
        assert not SeerNightShiftRun.objects.filter(organization=self.organization).exists()

    def test_requires_organization_access(self) -> None:
        other = self.create_organization()
        with self.feature(FEATURE):
            self.get_error_response(other.slug, strategy="duplicate_monitors", status_code=403)

    def test_creates_org_scan_as_member(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        team = self.create_team(organization=self.organization, members=[member])
        self.project.add_team(team)
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        other = self.create_project(organization=self.organization)
        self.create_detector(project=other, type="metric_issue")
        self.login_as(member)
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        assert run.extras["triggering_user_id"] == member.id
        assert "target_project_ids" not in run.extras
        assert run.shards.get().extras == {"status": "queued"}

    def test_allows_agent_to_discover_an_empty_organization(self) -> None:
        self.keep.delete()
        self.duplicate.delete()
        self.trigger()

    def test_validates_and_persists_result_once(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        output = validate_monitor_cleanup(self.artifact(), self.organization.id, self.project.id)
        shard = run.shards.get()
        finish_shard(shard.id, outputs=[output])
        finish_shard(shard.id, error="Late failure must not replace a completed result")
        run.refresh_from_db()
        assert run.results.count() == 1
        assert run.extras["status"] == "complete"
        assert run.date_completed is not None
        assert run.results.get().extras["groups"][0]["keep"]["name"] == "Keep"

    def test_completion_persists_chat_artifact(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        run.shards.get().update(seer_run=seer_run)
        state = SeerRunState(
            run_id=123,
            status="completed",
            updated_at="2026-09-09T00:00:00Z",
            blocks=[
                {
                    "id": "output",
                    "timestamp": "2026-09-09T00:00:00Z",
                    "message": {"role": "assistant", "content": "Done"},
                    "artifacts": [
                        {
                            "key": "monitor_cleanup",
                            "data": self.organization_artifact().dict(),
                            "reason": "Scan complete",
                        }
                    ],
                }
            ],
        )
        with patch("sentry.tasks.seer.monitor_cleanup.SeerAgentClient") as client:
            client.return_value.get_run.return_value = state
            collect_monitor_cleanup_result(self.organization.id, 123)
        result = run.results.get()
        assert result.result_seer_run_id == seer_run.id
        assert result.extras["projectSlug"] == self.project.slug
        assert result.extras["groups"][0]["matchingSettings"] == [
            {"label": "Trigger", "value": "More than 100 errors"}
        ]
        assert result.extras["groups"][0]["duplicates"][0]["id"] == str(self.duplicate.id)

    def test_completed_chat_without_artifact_fails(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        run.shards.get().update(seer_run=seer_run)
        state = SeerRunState(
            run_id=123, status="completed", updated_at="2026-09-09T00:00:00Z", blocks=[]
        )
        with patch("sentry.tasks.seer.monitor_cleanup.SeerAgentClient") as client:
            client.return_value.get_run.return_value = state
            collect_monitor_cleanup_result(self.organization.id, 123)
        run.refresh_from_db()
        assert run.extras["status"] == "failed"
        assert not run.results.exists()

    def test_rejects_cross_project_candidates(self) -> None:
        other_project = self.create_project(organization=self.organization)
        other = self.create_detector(project=other_project, type="metric_issue")
        with pytest.raises(ValueError, match="outside this project"):
            validate_monitor_cleanup(
                self.artifact(str(other.id)), self.organization.id, self.project.id
            )

    def test_rejects_survivor_as_duplicate(self) -> None:
        with pytest.raises(ValueError, match="overlapping"):
            validate_monitor_cleanup(
                self.artifact(str(self.keep.id)), self.organization.id, self.project.id
            )

    def test_rejects_legacy_monitor_id_above_bigint_range(self) -> None:
        with pytest.raises(ValueError, match="invalid monitor ID"):
            validate_monitor_cleanup(
                self.artifact("9223372036854775808"), self.organization.id, self.project.id
            )

    def test_rejects_monitor_id_above_bigint_range(self) -> None:
        with pytest.raises(ValueError, match="invalid monitor or alert ID"):
            validate_monitor_cleanup(
                self.finding_artifact(monitor_ids=[str(self.keep.id), "9223372036854775808"]),
                self.organization.id,
                self.project.id,
            )

    def test_rejects_alert_id_above_bigint_range(self) -> None:
        with pytest.raises(ValueError, match="invalid monitor or alert ID"):
            validate_monitor_cleanup(
                self.finding_artifact(
                    kind="duplicate_notifications", alert_ids=["9223372036854775808"]
                ),
                self.organization.id,
                self.project.id,
            )

    def test_history_does_not_expose_inaccessible_projects(self) -> None:
        run = SeerNightShiftRun.objects.get(id=self.trigger().data["runId"])
        outputs = prepare_monitor_cleanup_results(
            self.organization_artifact(), self.organization, self.user.id
        )
        finish_shard(run.shards.get().id, outputs=outputs)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.login_as(member)
        with self.feature(FEATURE):
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/",
                {"runId": run.id},
            )
        assert response.status_code == 200
        assert response.data == []

    def finding_artifact(self, **overrides):
        finding = {
            "kind": "overlapping_coverage",
            "monitor_ids": [str(self.keep.id), str(self.duplicate.id)],
            "reason": "Queries overlap but thresholds differ.",
            "example": "A burst of timeout errors can trigger both monitors.",
            "next_step": "Review whether the separate thresholds are intentional.",
            **overrides,
        }
        return MonitorCleanupArtifact(
            scan_status="complete",
            monitors_scanned=2,
            summary="Overlapping coverage",
            findings=[finding],
        )

    def test_overlap_has_no_keeper(self) -> None:
        output = validate_monitor_cleanup(
            self.finding_artifact(), self.organization.id, self.project.id
        )
        assert output["schemaVersion"] == 2
        findings = output["findings"]
        assert isinstance(findings, list)
        assert findings[0]["suggestedKeepId"] is None
        assert findings[0]["monitors"][0]["name"] == "Keep"

    def test_overlap_cannot_suggest_deletion(self) -> None:
        with pytest.raises(ValueError, match="must not recommend deletion"):
            validate_monitor_cleanup(
                self.finding_artifact(suggested_keep_id=str(self.keep.id)),
                self.organization.id,
                self.project.id,
            )

    def test_exact_finding_requires_member_as_keeper(self) -> None:
        with pytest.raises(ValueError, match="suggested keeper"):
            validate_monitor_cleanup(
                self.finding_artifact(kind="exact_duplicate"), self.organization.id, self.project.id
            )

    def test_allows_coverage_and_notifications_for_same_pair(self) -> None:
        workflow = self.create_workflow(
            organization=self.organization, name="Shared alert", enabled=False
        )
        self.create_detector_workflow(detector=self.keep, workflow=workflow)
        self.create_detector_workflow(detector=self.duplicate, workflow=workflow)
        artifact = self.finding_artifact()
        artifact.findings += self.finding_artifact(
            kind="duplicate_notifications", alert_ids=[str(workflow.id)]
        ).findings
        output = validate_monitor_cleanup(artifact, self.organization.id, self.project.id)
        findings = output["findings"]
        assert isinstance(findings, list)
        assert len(findings) == 2
        assert findings[1]["alerts"] == [
            {"id": str(workflow.id), "name": "Shared alert", "enabled": False}
        ]

    def test_rejects_alert_not_connected_to_both_monitors(self) -> None:
        workflow = self.create_workflow(organization=self.organization)
        self.create_detector_workflow(detector=self.keep, workflow=workflow)
        with pytest.raises(ValueError, match="alerts connected"):
            validate_monitor_cleanup(
                self.finding_artifact(kind="duplicate_notifications", alert_ids=[str(workflow.id)]),
                self.organization.id,
                self.project.id,
            )

    def test_rejects_cross_organization_alert(self) -> None:
        workflow = self.create_workflow(organization=self.create_organization())
        with pytest.raises(ValueError, match="alerts connected"):
            validate_monitor_cleanup(
                self.finding_artifact(kind="duplicate_notifications", alert_ids=[str(workflow.id)]),
                self.organization.id,
                self.project.id,
            )

    def test_rejects_repeated_finding(self) -> None:
        artifact = self.finding_artifact()
        artifact.findings *= 2
        with pytest.raises(ValueError, match="overlapping"):
            validate_monitor_cleanup(artifact, self.organization.id, self.project.id)

    def test_persists_comparison_values_by_monitor(self) -> None:
        artifact = self.finding_artifact(
            comparison=[
                {
                    "property": "Trigger",
                    "values": [
                        {"monitor_id": str(self.keep.id), "value": ">100 errors"},
                        {"monitor_id": str(self.duplicate.id), "value": ">500 errors"},
                    ],
                }
            ]
        )
        output = validate_monitor_cleanup(artifact, self.organization.id, self.project.id)
        findings = output["findings"]
        assert isinstance(findings, list)
        assert findings[0]["comparison"] == [
            {
                "property": "Trigger",
                "values": [
                    {"monitorId": str(self.keep.id), "value": ">100 errors"},
                    {"monitorId": str(self.duplicate.id), "value": ">500 errors"},
                ],
            }
        ]

    def test_rejects_incomplete_or_foreign_comparison_columns(self) -> None:
        artifact = self.finding_artifact(
            comparison=[
                {
                    "property": "Trigger",
                    "values": [
                        {"monitor_id": str(self.keep.id), "value": ">100 errors"},
                        {"monitor_id": "999999", "value": ">500 errors"},
                    ],
                }
            ]
        )
        with pytest.raises(ValueError, match="each finding monitor exactly once"):
            validate_monitor_cleanup(artifact, self.organization.id, self.project.id)
