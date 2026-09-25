from unittest.mock import patch

from django.test import override_settings

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models.night_shift import (
    SeerNightShiftRunErrorType,
    SeerNightShiftRunResult,
)
from sentry.seer.models.run import SeerAgentRun, SeerRunPullRequest
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowStrategy,
)
from sentry.seer.monitor_cleanup.runs import deliver_monitor_cleanup_result
from sentry.seer.workflows.runs import create_workflow_run
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories


@override_settings(SENTRY_SELF_HOSTED=False)
class OrganizationSeerWorkflowsTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflows"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_feature_flag_disabled_returns_404(self) -> None:
        SeerWorkflowRun.objects.create(organization=self.organization)
        self.get_error_response(self.organization.slug, status_code=404)

    def test_returns_runs_for_org_with_nested_results(self) -> None:
        group = self.create_group()
        run = SeerWorkflowRun.objects.create(
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
        assert response.data[0]["source"] is None
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
        run = SeerWorkflowRun.objects.create(organization=self.organization)
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
        run = SeerWorkflowRun.objects.create(organization=self.organization)
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

        run = SeerWorkflowRun.objects.create(organization=self.organization)
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

        run = SeerWorkflowRun.objects.create(organization=self.organization)
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

        run = SeerWorkflowRun.objects.create(organization=self.organization)
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

        run_a = SeerWorkflowRun.objects.create(organization=self.organization)
        SeerNightShiftRunResult.objects.create(
            run=run_a,
            kind="agentic_triage",
            group=group_a,
            result_seer_run=seer_run_a,
            extras={"action": "autofix_triggered"},
        )
        run_b = SeerWorkflowRun.objects.create(organization=self.organization)
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
        run = SeerWorkflowRun.objects.create(organization=self.organization)
        seer_run_a = self.create_seer_run(organization=self.organization, seer_run_state_id=111)
        seer_run_b = self.create_seer_run(organization=self.organization, seer_run_state_id=222)
        SeerWorkflowRunExecution.objects.create(run=run, seer_run=seer_run_a)
        SeerWorkflowRunExecution.objects.create(run=run, seer_run=seer_run_b)
        pending_run = self.create_seer_run(organization=self.organization, seer_run_state_id=None)
        SeerWorkflowRunExecution.objects.create(run=run, seer_run=pending_run)
        SeerWorkflowRunExecution.objects.create(run=run)

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
        run = SeerWorkflowRun.objects.create(organization=self.organization)
        SeerWorkflowRunExecution.objects.create(run=run)
        SeerWorkflowRunExecution.objects.create(
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
        run = SeerWorkflowRun.objects.create(
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
        dispatch_run = SeerWorkflowRun.objects.create(
            organization=self.organization,
            extras={"error_message": "Failed to dispatch 1 of 3 triage shards"},
        )
        no_access_run = SeerWorkflowRun.objects.create(
            organization=self.organization,
            extras={"error_message": "Organization does not have Seer access"},
        )
        unknown_run = SeerWorkflowRun.objects.create(
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
        older = SeerWorkflowRun.objects.create(organization=self.organization)
        newer = SeerWorkflowRun.objects.create(organization=self.organization)

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        assert [r["id"] for r in response.data] == [str(newer.id), str(older.id)]

    def test_runs_scoped_to_requesting_org(self) -> None:
        other_org = self.create_organization()
        SeerWorkflowRun.objects.create(organization=other_org)
        own_run = SeerWorkflowRun.objects.create(organization=self.organization)

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(own_run.id)

    def test_history_combines_workflows_and_respects_feature_flags(self) -> None:
        older = Factories.create_seer_workflow_run(
            organization=self.organization, extras={"options": {"source": None}}
        )
        cleanup = self.create_agent_workflow(
            SeerWorkflowStrategy.DUPLICATE_MONITORS, "monitor_cleanup"
        )
        triage_config = SeerWorkflowConfig.get_or_create_for_strategy(
            self.organization.id, SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        newer = Factories.create_seer_workflow_run(
            organization=self.organization,
            workflow_config=triage_config,
            extras={"options": {"source": "manual"}},
        )
        Factories.create_seer_workflow_run_execution(run=newer)
        Factories.create_seer_workflow_run_execution(run=newer)
        Factories.create_seer_workflow_run(organization=self.create_organization())

        with self.feature(
            ["organizations:seer-workflows-monitor-cleanup", "organizations:seer-night-shift"]
        ):
            response = self.get_success_response(self.organization.slug)
            assert response.status_code == 200
            assert [run["id"] for run in response.data] == [
                str(newer.id),
                str(cleanup.id),
                str(older.id),
            ]
            assert [run["source"] for run in response.data] == ["manual", None, None]
            response = self.get_success_response(self.organization.slug, per_page=2)
            assert [run["id"] for run in response.data] == [str(newer.id), str(cleanup.id)]

        with self.feature("organizations:seer-workflows-monitor-cleanup"):
            response = self.get_success_response(self.organization.slug)
            assert [run["id"] for run in response.data] == [str(cleanup.id)]

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)
            assert [run["id"] for run in response.data] == [str(newer.id), str(older.id)]

    def test_history_hides_runs_outside_user_access(self) -> None:
        project = self.project
        workflow = self.create_agent_workflow(
            SeerWorkflowStrategy.DUPLICATE_MONITORS, "monitor_cleanup"
        )
        run = workflow.executions.get().seer_run
        assert run is not None
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        other_team = self.create_team(organization=self.organization, members=[member])
        self.create_project(organization=self.organization, teams=[other_team])

        with self.feature("organizations:seer-workflows-monitor-cleanup"):
            response = self.get_success_response(self.organization.slug)
        assert [item["id"] for item in response.data] == [str(workflow.id)]

        self.login_as(member)
        with self.feature("organizations:seer-workflows-monitor-cleanup"):
            response = self.get_success_response(self.organization.slug)
        assert response.data == []

        run.agent.update(
            extras={**run.agent.extras, "status": "complete", "project_ids": [str(project.id)]}
        )
        with self.feature("organizations:seer-workflows-monitor-cleanup"):
            response = self.get_success_response(self.organization.slug)
        assert response.data == []

        self.create_team_membership(team=self.team, user=member)
        with self.feature("organizations:seer-workflows-monitor-cleanup"):
            response = self.get_success_response(self.organization.slug)
        assert [item["id"] for item in response.data] == [str(workflow.id)]

    def create_agent_workflow(
        self, strategy: SeerWorkflowStrategy, feature_id: str
    ) -> SeerWorkflowRun:
        with self.feature("organizations:gen-ai-features"):
            return create_workflow_run(
                SeerAgentClient(self.organization, self.user),
                strategy=strategy,
                feature_id=feature_id,
                title="Test workflow",
                payload={},
                extras={"project_ids": [], "results": []},
            )


@override_settings(SENTRY_SELF_HOSTED=False)
class OrganizationSeerMonitorCleanupTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflows"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        rate_limit_patcher = patch(
            "sentry.middleware.ratelimit.get_rate_limit_value", return_value=None
        )
        rate_limit_patcher.start()
        self.addCleanup(rate_limit_patcher.stop)
        self.keep = self.create_detector(project=self.project, type="metric_issue", name="Keep")
        self.duplicate = self.create_detector(
            project=self.project, type="metric_issue", name="Copy"
        )
        self.login_as(self.user)

    def test_scan_stores_findings_and_returns_them_in_history(self) -> None:
        run = self.trigger()
        assert run.source == "monitor_cleanup"
        assert run.extras["source"] == "manual"
        outbox = CellOutbox.objects.get(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.run_id
        )
        assert outbox.payload is not None
        assert outbox.payload["body"]["payload"] == {"response_version": 1}
        result = self.result()
        result["data"]["projects"][0]["scan_status"] = "partial"
        findings = result["data"]["projects"][0]["findings"]
        findings.extend(
            [
                {**findings[0], "monitor_ids": [str(self.keep.id), "999999"]},
                {**findings[0], "alert_ids": ["999999"]},
            ]
        )
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "completed", result, None
        )
        with self.feature("organizations:seer-workflows-monitor-cleanup"):
            response = self.client.get(self.url)
        assert response.status_code == 200
        output = response.data[0]
        assert output["id"] == str(run.run.workflow_execution.run_id)
        assert output["seerRunId"] == str(run.run.uuid)
        assert output["source"] == "manual"
        assert output["dateCompleted"] is not None
        assert output["dateCompleted"] == run.run.workflow_execution.run.date_completed
        assert output["extras"] == {"status": "partial"}
        assert len(output["results"]) == 1
        assert output["results"][0]["seerRunId"] == str(run.run.uuid)
        (finding,) = output["results"][0]["extras"]["findings"]
        assert finding["suggestedKeepId"] == str(self.keep.id)
        assert finding["monitors"] == [
            {"id": str(self.keep.id), "name": "Keep", "enabled": self.keep.enabled},
            {"id": str(self.duplicate.id), "name": "Copy", "enabled": self.duplicate.enabled},
        ]

    def test_invalid_results_report_safe_errors(self) -> None:
        run = self.trigger()
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "completed", {"schema_version": 1, "data": {}}, None
        )
        run.refresh_from_db()
        assert run.extras["status"] == "failed"
        assert not run.extras["results"]
        assert run.extras["error"] == "Seer returned results that could not be loaded."

        run = self.trigger()
        result = self.result()
        result["data"]["projects"][0]["project_id"] = "999999999"
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "completed", result, None
        )
        run.refresh_from_db()
        assert run.extras["status"] == "failed"
        assert run.extras["error"] == "Some scanned projects are no longer accessible."

    def test_requires_feature_and_seer_access(self) -> None:
        with patch("sentry.seer.monitor_cleanup.runs.ratelimits.is_limited") as limit:
            self.get_error_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=404
            )
            with self.feature(
                {
                    "organizations:seer-workflows-monitor-cleanup": True,
                    "organizations:gen-ai-features": False,
                }
            ):
                response = self.get_error_response(
                    self.organization.slug, strategy="duplicate_monitors", status_code=403
                )
            assert response.data == {"detail": "Seer is not available for this organization."}
            limit.assert_not_called()

            limit.return_value = True
            with self.feature(
                ["organizations:seer-workflows-monitor-cleanup", "organizations:gen-ai-features"]
            ):
                self.get_error_response(
                    self.organization.slug, strategy="duplicate_monitors", status_code=429
                )
            limit.assert_called_once_with(
                f"seer-workflow:{self.organization.id}:duplicate_monitors", limit=5, window=3600
            )

    def test_requires_organization_access(self) -> None:
        other = self.create_organization()
        with self.feature("organizations:seer-workflows-monitor-cleanup"):
            self.get_error_response(other.slug, strategy="duplicate_monitors", status_code=403)

    def test_callback_for_deleted_user_marks_run_failed(self) -> None:
        agent_run = self.trigger()
        agent_run.run.update(user_id=999999999)
        deliver_monitor_cleanup_result(
            self.organization.id, agent_run.run.uuid, "completed", self.result(), None
        )
        agent_run.refresh_from_db()
        assert agent_run.extras["status"] == "failed"
        assert agent_run.extras["error"] == "The triggering user no longer exists."

    def trigger(self):
        with self.feature(
            ["organizations:seer-workflows-monitor-cleanup", "organizations:gen-ai-features"]
        ):
            response = self.get_success_response(
                self.organization.slug, strategy="duplicate_monitors", status_code=202
            )
        return SeerAgentRun.objects.select_related("run").get(
            run__workflow_execution__run_id=response.data["runId"]
        )

    @property
    def url(self):
        return f"/api/0/organizations/{self.organization.slug}/seer/workflows/"

    def result(self):
        return {
            "schema_version": 1,
            "data": {
                "scan_status": "complete",
                "projects": [
                    {
                        "project_id": str(self.project.id),
                        "scan_status": "complete",
                        "monitors_scanned": 2,
                        "summary": "Duplicate monitors found.",
                        "findings": [
                            {
                                "kind": "exact_duplicate",
                                "monitor_ids": [str(self.keep.id), str(self.duplicate.id)],
                                "suggested_keep_id": str(self.keep.id),
                                "reason": "Identical settings.",
                            }
                        ],
                    }
                ],
            },
        }
