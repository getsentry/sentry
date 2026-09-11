from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import UUID

import pytest
from django.db import router, transaction
from django.test import RequestFactory, override_settings
from django.utils import timezone
from rest_framework.request import Request

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunErrorType,
    SeerNightShiftRunResult,
    SeerNightShiftRunShard,
)
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunPullRequest
from sentry.seer.monitor_cleanup import FEATURE
from sentry.seer.monitor_cleanup.results import (
    format_monitor_cleanup_results,
    prepare_monitor_cleanup_results,
)
from sentry.seer.monitor_cleanup.runs import (
    create_monitor_cleanup_run,
    deliver_monitor_cleanup_result,
    finish_run,
)
from sentry.seer.monitor_cleanup.schemas import (
    MonitorCleanupArtifact,
    OrganizationMonitorCleanupArtifact,
)
from sentry.tasks.seer.monitor_cleanup import expire_run
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories


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
        seer_access = patch(
            "sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None)
        )
        seer_access.start()
        self.addCleanup(seer_access.stop)

    def trigger(self):
        with (
            self.feature(FEATURE),
            patch("sentry.tasks.seer.monitor_cleanup.expire_run.apply_async"),
        ):
            return self.get_success_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=202
            )

    def artifact(self, duplicate_id: str | None = None):
        return self.finding_artifact(
            kind="exact_duplicate",
            suggested_keep_id=str(self.keep.id),
            monitor_ids=[str(self.keep.id), duplicate_id or str(self.duplicate.id)],
        )

    def organization_artifact(self):
        return OrganizationMonitorCleanupArtifact(
            scan_status="complete",
            projects=[{"project_id": str(self.project.id), **self.finding_artifact().dict()}],
        )

    def test_starts_one_agent_for_all_projects(self) -> None:
        for _ in range(21):
            self.create_project(organization=self.organization)
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        assert run.source == "monitor_cleanup"
        assert run.project_id is None
        assert run.group_id is None
        outbox = CellOutbox.objects.get(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.run_id
        )
        assert outbox.payload is not None
        assert outbox.payload["body"]["feature_id"] == "monitor_cleanup"
        assert outbox.payload["viewer_context"]["user_id"] == self.user.id
        assert not SeerNightShiftRun.objects.filter(organization=self.organization).exists()
        assert not SeerNightShiftRunShard.objects.filter(
            run__organization=self.organization
        ).exists()

    def test_one_scan_persists_results_from_multiple_projects(self) -> None:
        other_project = self.create_project(organization=self.organization)
        artifact = self.organization_artifact()
        artifact.projects.append(
            artifact.projects[0].copy(
                update={"project_id": other_project.id, "findings": [], "monitors_scanned": 1}
            )
        )
        outputs = prepare_monitor_cleanup_results(artifact, self.organization, self.user.id)
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        finish_run(run.run_id, outputs=outputs)
        run.refresh_from_db()
        assert len(run.extras["results"]) == 2
        assert {result["projectSlug"] for result in run.extras["results"]} == {
            self.project.slug,
            other_project.slug,
        }
        run.refresh_from_db()
        assert run.extras["status"] == "complete"

    def test_empty_scan_completes(self) -> None:
        artifact = OrganizationMonitorCleanupArtifact(scan_status="complete", projects=[])
        outputs = prepare_monitor_cleanup_results(artifact, self.organization, self.user.id)
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        finish_run(run.run_id, outputs=outputs)
        run.refresh_from_db()
        assert run.extras["status"] == "complete"
        assert not run.extras["results"]

    def test_partial_discovery_stays_partial(self) -> None:
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        finish_run(run.run_id, outputs=[], scan_status="partial")
        run.refresh_from_db()
        assert run.extras["status"] == "partial"
        assert run.extras["date_completed"] is not None

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
        artifact.projects[0].project_id = foreign.id
        with pytest.raises(ValueError, match="no longer accessible"):
            prepare_monitor_cleanup_results(artifact, self.organization, self.user.id)

    def test_trigger_creates_agent_run(self) -> None:
        response = self.trigger()
        run = SeerAgentRun.objects.get(run__uuid=response.data["runId"])
        assert run.run.user_id == self.user.id
        assert run.run.type == "feature_run"
        assert run.extras["status"] == "running"
        assert run.extras["results"] == []
        assert f"runId={run.run.uuid}" in response.data["url"]

    def test_history_combines_runs_and_paginates_in_date_order(self) -> None:
        triage = Factories.create_seer_night_shift_run(organization=self.organization)
        cleanup = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        url = f"/api/0/organizations/{self.organization.slug}/seer/workflows/"
        with self.feature([FEATURE, "organizations:seer-night-shift"]):
            first = self.client.get(url, {"per_page": "1"})
            second = self.client.get(url, {"per_page": "1", "cursor": "1:1:0"})
            cleanup_detail = self.client.get(url, {"runId": str(cleanup.run.uuid)})
            triage_detail = self.client.get(url, {"runId": str(triage.id)})
        assert first.status_code == second.status_code == 200
        assert [run["id"] for run in first.data] == [str(cleanup.run.uuid)]
        assert [run["id"] for run in second.data] == [str(triage.id)]
        assert [run["id"] for run in cleanup_detail.data] == [str(cleanup.run.uuid)]
        assert [run["id"] for run in triage_detail.data] == [str(triage.id)]
        assert first.data[0]["extras"] == {"status": "running"}
        assert first.data[0]["results"] == []
        assert first.data[0]["dateAdded"] == cleanup.run.date_added
        assert first.data[0]["dateCompleted"] is None
        assert second.data[0]["dateAdded"] == triage.date_added
        assert second.data[0]["dateCompleted"] is None

    def test_history_gates_each_feature_independently(self) -> None:
        triage = Factories.create_seer_night_shift_run(organization=self.organization)
        cleanup = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        url = f"/api/0/organizations/{self.organization.slug}/seer/workflows/"
        with self.feature({FEATURE: False, "organizations:seer-night-shift": True}):
            response = self.client.get(url)
        assert [run["id"] for run in response.data] == [str(triage.id)]
        with self.feature({FEATURE: True, "organizations:seer-night-shift": False}):
            response = self.client.get(url)
        assert [run["id"] for run in response.data] == [str(cleanup.run.uuid)]

    def test_history_serializes_completed_findings_without_internal_run_id(self) -> None:
        run, seer_run = self.deliver(
            {"schema_version": 1, "data": self.organization_artifact().dict()}
        )
        seer_run.update(seer_run_state_id=987654321)
        with self.feature(FEATURE):
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/",
                {"runId": str(seer_run.uuid)},
            )
        assert response.status_code == 200
        output = response.data[0]
        assert output["id"] == str(seer_run.uuid)
        assert output["extras"] == {"status": "complete"}
        assert output["dateAdded"] == seer_run.date_added
        assert output["dateCompleted"] == datetime.fromisoformat(run.extras["date_completed"])
        assert (
            datetime.fromisoformat(response.json()[0]["dateCompleted"]) == output["dateCompleted"]
        )
        assert output["results"][0]["seerRunId"] == str(seer_run.uuid)
        assert output["results"][0]["extras"]["projectId"] == str(self.project.id)
        assert "987654321" not in response.content.decode()

    def test_delivery_ignores_other_feature_runs(self) -> None:
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        run.update(source="smart_assignment")
        deliver_monitor_cleanup_result(
            self.organization.id,
            run.run.uuid,
            "completed",
            {"schema_version": 1, "data": self.organization_artifact().dict()},
            None,
        )
        run.refresh_from_db()
        assert run.extras["status"] == "running"
        assert run.extras["results"] == []

    def test_each_click_starts_a_feature_run(self) -> None:
        first = self.trigger().data["runId"]
        second = self.trigger().data["runId"]
        assert first != second
        assert SeerAgentRun.objects.filter(run__organization=self.organization).count() == 2

    def test_allows_scan_after_previous_run_completes(self) -> None:
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        finish_run(run.run_id, error="Scan failed")
        assert self.trigger().data["runId"] != str(run.run.uuid)

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_rate_limits_repeated_triggers(self) -> None:
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        finish_run(run.run_id, error="Scan failed")
        with self.feature(FEATURE):
            self.get_error_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=429
            )
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/"
            )
        assert response.status_code == 200
        assert SeerAgentRun.objects.filter(run__organization=self.organization).count() == 1

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_limits_scans_per_organization_per_hour(self) -> None:
        for _ in range(5):
            user = self.create_user()
            self.create_member(organization=self.organization, user=user, role="owner")
            self.login_as(user)
            self.trigger()
        self.login_as(self.user)
        with self.feature(FEATURE):
            self.get_error_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=429
            )
        assert SeerAgentRun.objects.filter(run__organization=self.organization).count() == 5

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
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        run_id = run.run_id
        run.run.delete()
        finish_run(run_id, error="Late failure")
        expire_run(run_id)

    def test_timeout_finishes_stranded_run_without_polling(self) -> None:
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        run.run.update(date_added=timezone.now() - timedelta(minutes=16))
        expire_run(run.run_id)
        run.refresh_from_db()
        assert run.extras["status"] == "failed"
        assert run.extras["date_completed"] is not None

    def test_timeout_does_not_overwrite_completed_run(self) -> None:
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        finish_run(run.run_id, outputs=[])
        run.run.update(date_added=timezone.now() - timedelta(minutes=16))
        expire_run(run.run_id)
        run.refresh_from_db()
        assert run.extras["status"] == "complete"

    def test_timeout_is_queued_after_commit(self) -> None:
        request = Request(RequestFactory().get("/"))
        request.user = self.user
        with (
            self.feature(FEATURE),
            patch("sentry.tasks.seer.monitor_cleanup.expire_run.apply_async") as enqueue,
            self.capture_on_commit_callbacks(execute=True),
            transaction.atomic(using=router.db_for_write(SeerRun)),
        ):
            run = create_monitor_cleanup_run(request, self.organization)
            enqueue.assert_not_called()
        enqueue.assert_called_once_with(args=[run.id], countdown=900)

    def test_rolled_back_trigger_does_not_schedule_timeout(self) -> None:
        request = Request(RequestFactory().get("/"))
        request.user = self.user
        with (
            self.feature(FEATURE),
            patch("sentry.tasks.seer.monitor_cleanup.expire_run.apply_async") as enqueue,
            self.capture_on_commit_callbacks(execute=True),
        ):
            with (
                pytest.raises(RuntimeError),
                transaction.atomic(using=router.db_for_write(SeerRun)),
            ):
                create_monitor_cleanup_run(request, self.organization)
                raise RuntimeError("Rollback")
        enqueue.assert_not_called()
        assert not SeerAgentRun.objects.filter(run__organization=self.organization).exists()
        assert not CellOutbox.objects.filter(category=OutboxCategory.SEER_RUN_CREATE).exists()

    def test_timeout_enqueue_failure_marks_committed_run_failed(self) -> None:
        with (
            self.feature(FEATURE),
            patch(
                "sentry.tasks.seer.monitor_cleanup.expire_run.apply_async", side_effect=RuntimeError
            ),
            self.capture_on_commit_callbacks(execute=True),
        ):
            response = self.get_success_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=202
            )
        run = SeerAgentRun.objects.get(run__uuid=response.data["runId"])
        assert run.extras["status"] == "failed"
        assert "timeout" in run.extras["error"]
        assert CellOutbox.objects.filter(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.run_id
        ).exists()

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
        assert not SeerAgentRun.objects.filter(run__organization=self.organization).exists()

    def test_rejects_strategy_without_manual_handler(self) -> None:
        with self.feature(FEATURE):
            response = self.get_error_response(
                self.organization.slug, strategy="agentic_triage", status_code=400
            )
        assert "strategy" in response.data["detail"]
        assert not SeerAgentRun.objects.filter(run__organization=self.organization).exists()

    def test_requires_strategy(self) -> None:
        with self.feature(FEATURE):
            response = self.get_error_response(self.organization.slug, status_code=400)
        assert "strategy" in response.data["detail"]
        assert not SeerAgentRun.objects.filter(run__organization=self.organization).exists()

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
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        assert run.run.user_id == member.id
        assert "target_project_ids" not in run.extras
        assert run.extras["status"] == "running"

    def test_allows_agent_to_discover_an_empty_organization(self) -> None:
        self.keep.delete()
        self.duplicate.delete()
        self.trigger()

    def test_validates_and_persists_result_once(self) -> None:
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        output = format_monitor_cleanup_results(
            self.artifact(), self.organization.id, self.project.id
        )
        finish_run(run.run_id, outputs=[output])
        finish_run(run.run_id, error="Late failure must not replace a completed result")
        run.refresh_from_db()
        assert len(run.extras["results"]) == 1
        assert run.extras["status"] == "complete"
        assert run.extras["date_completed"] is not None
        assert run.extras["results"][0]["findings"][0]["monitors"][0]["name"] == "Keep"

    def deliver(self, result, status="completed", organization_id=None):
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        seer_run = run.run
        deliver_monitor_cleanup_result(
            organization_id or self.organization.id, seer_run.uuid, status, result, None
        )
        run.refresh_from_db()
        return run, seer_run

    def test_delivery_persists_versioned_result_idempotently(self) -> None:
        result = {"schema_version": 1, "data": self.organization_artifact().dict()}
        run, seer_run = self.deliver(result)
        deliver_monitor_cleanup_result(
            self.organization.id, seer_run.uuid, "completed", result, None
        )
        deliver_monitor_cleanup_result(
            self.organization.id, seer_run.uuid, "error", None, "late error"
        )
        assert len(run.extras["results"]) == 1
        output = run.extras["results"][0]
        assert output["schemaVersion"] == 1
        assert output["projectSlug"] == self.project.slug
        assert output["findings"][0]["monitors"][1]["id"] == str(self.duplicate.id)
        run.refresh_from_db()
        assert run.extras["status"] == "complete"
        assert run.extras["response_schema_version"] == 1

    def test_missing_response_version_fails(self) -> None:
        run, _ = self.deliver({"data": self.organization_artifact().dict()})
        assert run.extras["status"] == "failed"
        assert "could not be loaded" in run.extras["error"]
        assert not run.extras["results"]

    def test_unknown_response_version_fails(self) -> None:
        run, _ = self.deliver({"schema_version": 2, "data": {"new_shape": True}})
        assert run.extras["status"] == "failed"
        assert "could not be loaded" in run.extras["error"]
        assert not run.extras["results"]

    def test_invalid_versioned_response_fails(self) -> None:
        run, _ = self.deliver({"schema_version": 1, "data": {}})
        assert run.extras["status"] == "failed"
        assert not run.extras["results"]

    def test_additive_response_fields_are_compatible(self) -> None:
        result = {
            "schema_version": 1,
            "data": self.organization_artifact().dict(),
            "new_field": True,
        }
        result["data"]["new_field"] = True
        run, _ = self.deliver(result)
        assert run.extras["status"] == "complete"
        assert len(run.extras["results"]) == 1

    def test_delivery_handles_agent_failure(self) -> None:
        run, _ = self.deliver(None, status="error")
        assert run.extras["status"] == "failed"
        assert not run.extras["results"]

    def test_delivery_handles_missing_artifact(self) -> None:
        run, _ = self.deliver(None)
        assert run.extras["status"] == "failed"

    def test_delivery_is_scoped_to_organization(self) -> None:
        run, _ = self.deliver(
            {"schema_version": 1, "data": self.organization_artifact().dict()},
            organization_id=self.create_organization().id,
        )
        assert run.extras["date_completed"] is None
        assert not run.extras["results"]

    def test_delivery_preserves_partial_status(self) -> None:
        data = self.organization_artifact().dict()
        data["scan_status"] = "partial"
        run, _ = self.deliver({"schema_version": 1, "data": data})
        assert run.extras["status"] == "partial"

    def test_rejects_cross_project_candidates(self) -> None:
        other_project = self.create_project(organization=self.organization)
        other = self.create_detector(project=other_project, type="metric_issue")
        with pytest.raises(KeyError):
            format_monitor_cleanup_results(
                self.artifact(str(other.id)), self.organization.id, self.project.id
            )

    def test_history_does_not_expose_inaccessible_projects(self) -> None:
        run = SeerAgentRun.objects.get(run__uuid=self.trigger().data["runId"])
        outputs = prepare_monitor_cleanup_results(
            self.organization_artifact(), self.organization, self.user.id
        )
        finish_run(run.run_id, outputs=outputs)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.login_as(member)
        with self.feature(FEATURE):
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/",
                {"runId": str(run.run.uuid)},
            )
        assert response.status_code == 200
        assert response.data == []

    def finding_artifact(self, **overrides):
        finding = {
            "kind": "overlapping_coverage",
            "monitor_ids": [str(self.keep.id), str(self.duplicate.id)],
            "reason": "Queries overlap but thresholds differ.",
            **overrides,
        }
        return MonitorCleanupArtifact(
            scan_status="complete",
            monitors_scanned=2,
            summary="Overlapping coverage",
            findings=[finding],
        )

    def test_overlap_has_no_keeper(self) -> None:
        output = format_monitor_cleanup_results(
            self.finding_artifact(), self.organization.id, self.project.id
        )
        assert output["schemaVersion"] == 1
        findings = output["findings"]
        assert findings[0]["suggestedKeepId"] is None
        assert findings[0]["monitors"][0]["name"] == "Keep"

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
        output = format_monitor_cleanup_results(artifact, self.organization.id, self.project.id)
        assert output["schemaVersion"] == 1
        findings = output["findings"]
        assert len(findings) == 2
        assert findings[1]["alerts"] == [
            {"id": str(workflow.id), "name": "Shared alert", "enabled": False}
        ]

    def test_rejects_cross_organization_alert(self) -> None:
        workflow = self.create_workflow(organization=self.create_organization())
        with pytest.raises(KeyError):
            format_monitor_cleanup_results(
                self.finding_artifact(kind="duplicate_notifications", alert_ids=[str(workflow.id)]),
                self.organization.id,
                self.project.id,
            )

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
        output = format_monitor_cleanup_results(artifact, self.organization.id, self.project.id)
        assert output["schemaVersion"] == 1
        findings = output["findings"]
        assert findings[0]["comparison"] == [
            {
                "property": "Trigger",
                "values": [
                    {"monitorId": str(self.keep.id), "value": ">100 errors"},
                    {"monitorId": str(self.duplicate.id), "value": ">500 errors"},
                ],
            }
        ]

    def test_delivery_handles_missing_monitor(self) -> None:
        data = self.organization_artifact().dict()
        data["projects"][0]["findings"][0]["monitor_ids"] = [self.keep.id, 999999999]
        run, _ = self.deliver({"schema_version": 1, "data": data})
        assert run.extras["status"] == "failed"
        assert not run.extras["results"]

    def test_delivery_handles_monitor_id_outside_database_range(self) -> None:
        data = self.organization_artifact().dict()
        data["projects"][0]["findings"][0]["monitor_ids"] = [self.keep.id, 2**63]
        run, _ = self.deliver({"schema_version": 1, "data": data})
        assert run.extras["status"] == "failed"
        assert not run.extras["results"]

    def test_delivery_preserves_agent_recommendations(self) -> None:
        data = self.organization_artifact().dict()
        finding = data["projects"][0]["findings"][0]
        finding["suggested_keep_id"] = self.keep.id
        finding["reason"] = "Detailed explanation. " * 150
        finding["comparison"] = [
            {"property": "Trigger", "values": [{"monitor_id": self.keep.id, "value": ">100"}]}
        ]
        run, _ = self.deliver({"schema_version": 1, "data": data})
        assert run.extras["status"] == "complete"
        output = run.extras["results"][0]["findings"][0]
        assert output["suggestedKeepId"] == str(self.keep.id)
        assert output["reason"] == finding["reason"]
        assert output["comparison"] == [
            {"property": "Trigger", "values": [{"monitorId": str(self.keep.id), "value": ">100"}]}
        ]

    def test_history_returns_night_shift_completion_datetime(self) -> None:
        completed_at = timezone.now()
        run = Factories.create_seer_night_shift_run(
            organization=self.organization, date_completed=completed_at
        )
        with self.feature("organizations:seer-night-shift"):
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/",
                {"runId": str(run.id)},
            )
        assert response.status_code == 200
        assert response.data[0]["dateCompleted"] == completed_at
        assert datetime.fromisoformat(response.json()[0]["dateCompleted"]) == completed_at

    def test_history_rejects_invalid_run_id(self) -> None:
        with self.feature(FEATURE):
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/",
                {"runId": "not-a-run-id"},
            )
        assert response.status_code == 400
        assert "detail" in response.data

    def test_history_accepts_numeric_uuid(self) -> None:
        run = SeerRun.objects.get(uuid=self.trigger().data["runId"])
        run.update(uuid=UUID("12345678-1234-1234-1234-123456789012"))
        with self.feature(FEATURE):
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/seer/workflows/",
                {"runId": run.uuid.hex},
            )
        assert response.status_code == 200
        assert response.data[0]["id"] == str(run.uuid)
