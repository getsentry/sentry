from datetime import datetime
from unittest.mock import Mock, patch

import pytest

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.receivers.outbox.cell import handle_seer_run_create
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models.night_shift import (
    SeerNightShiftRunErrorType,
    SeerNightShiftRunResult,
)
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunMirrorStatus, SeerRunPullRequest
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowStrategy,
)
from sentry.seer.monitor_cleanup.constants import FEATURE
from sentry.seer.monitor_cleanup.runs import deliver_monitor_cleanup_result
from sentry.seer.workflows.runs import (
    create_workflow_run,
    deliver_workflow_result,
    finish_workflow_run,
)
from sentry.seer.workflows.schemas import WorkflowResult
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


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


class OrganizationSeerMonitorCleanupTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflows"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
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
        dispatch = patch(
            "sentry.receivers.outbox.cell.make_feature_run_request",
            return_value=Mock(status=200, json=Mock(return_value={"run_id": 1234})),
        )
        self.dispatch = dispatch.start()
        self.addCleanup(dispatch.stop)

    def test_starts_feature_run(self) -> None:
        run = self.trigger()
        workflow_run = run.run.workflow_execution.run
        assert workflow_run.organization_id == self.organization.id
        assert workflow_run.workflow_config == SeerWorkflowConfig.get_or_create_for_strategy(
            self.organization.id, SeerWorkflowStrategy.DUPLICATE_MONITORS
        )
        assert workflow_run.executions.count() == 1
        assert run.run.user_id == self.user.id
        assert run.run.seer_run_state_id is None
        assert run.run.mirror_status == SeerRunMirrorStatus.PENDING
        assert run.extras["status"] == "running"
        assert run.extras["results"] == []
        self.dispatch.assert_not_called()
        assert CellOutbox.objects.filter(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.run_id
        ).exists()

        with outbox_runner():
            pass

        dispatched_run = SeerRun.objects.get(id=run.run_id)
        assert dispatched_run.seer_run_state_id == 1234
        assert dispatched_run.mirror_status == SeerRunMirrorStatus.LIVE
        self.dispatch.assert_called_once()
        body = self.dispatch.call_args.args[0]
        assert body["feature_id"] == body["referrer"] == "monitor_cleanup"
        assert body["payload"] == {"response_version": 1}
        assert self.dispatch.call_args.kwargs["viewer_context"]["user_id"] == self.user.id

    def test_callback_saves_results_and_returns_them_in_history(self) -> None:
        run = self.trigger()
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "completed", self.result(), None
        )
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "error", None, "Late failure"
        )
        run.refresh_from_db()
        assert run.extras["status"] == "complete"
        assert len(run.extras["results"]) == 1
        finding = run.extras["results"][0]["findings"][0]
        assert finding["suggestedKeepId"] == str(self.keep.id)
        assert finding["monitors"] == [
            {"id": str(self.keep.id), "name": "Keep", "enabled": self.keep.enabled},
            {"id": str(self.duplicate.id), "name": "Copy", "enabled": self.duplicate.enabled},
        ]
        with self.feature(FEATURE):
            response = self.client.get(self.url)
        assert response.status_code == 200
        output = response.data[0]
        assert output["id"] == str(run.run.workflow_execution.run_id)
        assert output["seerRunId"] == str(run.run.uuid)
        assert output["results"][0]["seerRunId"] == str(run.run.uuid)
        assert output["extras"] == {"status": "complete"}
        assert output["results"][0]["extras"] == run.extras["results"][0]
        assert (
            datetime.fromisoformat(response.json()[0]["dateCompleted"]) == output["dateCompleted"]
        )

    def test_dispatch_failure_appears_in_history(self) -> None:
        self.dispatch.return_value = Mock(status=422)
        run = self.trigger()
        self.dispatch.assert_not_called()
        with outbox_runner():
            pass
        run.run.refresh_from_db()
        assert run.run.mirror_status == SeerRunMirrorStatus.FAILED
        with self.feature(FEATURE):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data[0]["extras"] == {"status": "failed"}
        assert response.data[0]["errorMessage"] == "Seer could not start this workflow."

    def test_transient_dispatch_failure_can_retry(self) -> None:
        run = self.trigger()
        outbox = CellOutbox.objects.get(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.run_id
        )
        self.dispatch.return_value = Mock(status=503)
        with pytest.raises(RuntimeError, match="transient error 503"):
            handle_seer_run_create(run.run_id, outbox.payload)
        run.run.refresh_from_db()
        assert run.run.mirror_status == SeerRunMirrorStatus.PENDING
        assert CellOutbox.objects.filter(id=outbox.id).exists()

        self.dispatch.return_value = Mock(status=200, json=Mock(return_value={"run_id": 1234}))
        with outbox_runner():
            pass
        run.run.refresh_from_db()
        assert run.run.mirror_status == SeerRunMirrorStatus.LIVE
        assert not CellOutbox.objects.filter(id=outbox.id).exists()

    def test_history_combines_workflows_and_respects_feature_flags(self) -> None:
        older = Factories.create_seer_workflow_run(organization=self.organization)
        cleanup = self.trigger().run.workflow_execution.run
        triage_config = SeerWorkflowConfig.get_or_create_for_strategy(
            self.organization.id, SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        newer = Factories.create_seer_workflow_run(
            organization=self.organization, workflow_config=triage_config
        )
        Factories.create_seer_workflow_run_execution(run=newer)
        Factories.create_seer_workflow_run_execution(run=newer)
        Factories.create_seer_workflow_run(organization=self.create_organization())

        with self.feature([FEATURE, "organizations:seer-night-shift"]):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert [run["id"] for run in response.data] == [
                str(newer.id),
                str(cleanup.id),
                str(older.id),
            ]
            response = self.client.get(self.url, {"per_page": 2})
            assert [run["id"] for run in response.data] == [str(newer.id), str(cleanup.id)]

        with self.feature(FEATURE):
            response = self.client.get(self.url)
            assert [run["id"] for run in response.data] == [str(cleanup.id)]

        with self.feature("organizations:seer-night-shift"):
            response = self.client.get(self.url)
            assert [run["id"] for run in response.data] == [str(newer.id), str(older.id)]

    def test_callback_failure_marks_run_failed(self) -> None:
        run = self.trigger()
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "error", None, "Agent failed"
        )
        run.refresh_from_db()
        assert run.extras["status"] == "failed"
        assert run.extras["date_completed"] is not None
        assert not run.extras["results"]

    def test_invalid_result_marks_run_failed(self) -> None:
        run = self.trigger()
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "completed", {"schema_version": 1, "data": {}}, None
        )
        run.refresh_from_db()
        assert run.extras["status"] == "failed"
        assert not run.extras["results"]

    def test_requires_feature(self) -> None:
        self.get_error_response(
            self.organization.slug, strategy="duplicate_monitors", status_code=404
        )

    def test_requires_organization_access(self) -> None:
        other = self.create_organization()
        with self.feature(FEATURE):
            self.get_error_response(other.slug, strategy="duplicate_monitors", status_code=403)

    def test_callback_is_scoped_to_organization(self) -> None:
        run = self.trigger()
        deliver_monitor_cleanup_result(
            self.create_organization().id, run.run.uuid, "completed", self.result(), None
        )
        run.refresh_from_db()
        assert run.extras["status"] == "running"
        assert not run.extras["results"]

    def test_history_hides_inaccessible_projects(self) -> None:
        run = self.trigger()
        deliver_monitor_cleanup_result(
            self.organization.id, run.run.uuid, "completed", self.result(), None
        )
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.login_as(member)
        with self.feature(FEATURE):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == []

    def test_running_history_without_recorded_projects_is_visible_only_to_creator(self) -> None:
        self._assert_history_without_recorded_projects_is_visible_only_to_creator("running")

    def test_failed_history_without_recorded_projects_is_visible_only_to_creator(self) -> None:
        self._assert_history_without_recorded_projects_is_visible_only_to_creator("failed")

    def test_empty_completed_history_is_visible_only_to_creator(self) -> None:
        self._assert_history_without_recorded_projects_is_visible_only_to_creator("complete")

    def _assert_history_without_recorded_projects_is_visible_only_to_creator(
        self, status: str
    ) -> None:
        agent_run = self.trigger()
        agent_run.update(extras={**agent_run.extras, "status": status})
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")

        with self.feature(FEATURE):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert [run["id"] for run in response.data] == [
            str(agent_run.run.workflow_execution.run_id)
        ]

        self.login_as(member)
        with self.feature(FEATURE):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == []

        team = self.create_team(organization=self.organization, members=[member])
        self.create_project(organization=self.organization, teams=[team])
        with self.feature(FEATURE):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == []

    def test_history_with_recorded_projects_is_visible_to_other_project_members(self) -> None:
        agent_run = self.trigger()
        deliver_monitor_cleanup_result(
            self.organization.id, agent_run.run.uuid, "completed", self.result(), None
        )
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member = self.create_user()
        self.create_member(
            organization=self.organization, user=member, role="member", teams=[self.team]
        )
        self.login_as(member)
        with self.feature(FEATURE):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert [run["id"] for run in response.data] == [
            str(agent_run.run.workflow_execution.run_id)
        ]

    def test_org_token_cannot_own_history_after_triggering_user_is_deleted(self) -> None:
        agent_run = self.trigger()
        agent_run.run.update(user_id=None)
        token = generate_token(self.organization.slug, "")
        self.create_org_auth_token(
            name="org-auth-token",
            token_hashed=hash_token(token),
            organization_id=self.organization.id,
            scope_list=["org:read"],
        )
        with self.feature(FEATURE):
            response = self.client.get(self.url, HTTP_AUTHORIZATION=f"Bearer {token}")
        assert response.status_code == 200
        assert response.data == []

    def test_workflow_helpers_support_other_result_shapes(self) -> None:
        workflow_run = create_workflow_run(
            SeerAgentClient(self.organization, self.user),
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE,
            feature_id="test_workflow",
            title="Test workflow",
            payload={"scope": "organization"},
            extras={"summary": None},
        )
        seer_run = workflow_run.executions.get().seer_run
        assert seer_run is not None
        self.dispatch.assert_not_called()
        assert workflow_run.workflow_config is not None
        assert workflow_run.workflow_config.strategy == SeerWorkflowStrategy.AGENTIC_TRIAGE
        assert seer_run.agent.extras == {
            "status": "running",
            "date_completed": None,
            "error": None,
            "summary": None,
        }
        parser = Mock(
            return_value=WorkflowResult(extras={"summary": "Work finished"}, status="partial")
        )
        deliver_workflow_result(
            feature_id="test_workflow",
            organization_id=self.organization.id,
            run_uuid=seer_run.uuid,
            status="completed",
            result={"summary": "raw output"},
            error=None,
            parse_result=parser,
        )
        parser.assert_called_once_with({"summary": "raw output"}, seer_run.agent)
        seer_run.agent.refresh_from_db()
        assert seer_run.agent.extras["status"] == "partial"
        assert seer_run.agent.extras["summary"] == "Work finished"
        assert seer_run.agent.extras["date_completed"] is not None

        finish_workflow_run(
            seer_run.id,
            organization_id=self.organization.id,
            feature_id="test_workflow",
            error="Late failure",
        )
        seer_run.agent.refresh_from_db()
        assert seer_run.agent.extras["status"] == "partial"
        assert seer_run.agent.extras["error"] is None

    def test_workflow_creation_rolls_back_if_execution_creation_fails(self) -> None:
        with (
            patch(
                "sentry.seer.workflows.runs.SeerWorkflowRunExecution.objects.create",
                side_effect=RuntimeError("Cannot create execution"),
            ),
            pytest.raises(RuntimeError, match="Cannot create execution"),
        ):
            create_workflow_run(
                SeerAgentClient(self.organization, self.user),
                strategy=SeerWorkflowStrategy.DUPLICATE_MONITORS,
                feature_id="monitor_cleanup",
                title="Monitor cleanup",
                payload={},
            )
        assert not SeerWorkflowRun.objects.filter(organization=self.organization).exists()
        assert not SeerRun.objects.filter(organization=self.organization).exists()
        assert not SeerAgentRun.objects.filter(run__organization=self.organization).exists()
        assert not CellOutbox.objects.filter(category=OutboxCategory.SEER_RUN_CREATE).exists()
        self.dispatch.assert_not_called()

    def test_workflow_delivery_and_finish_are_scoped_to_feature(self) -> None:
        agent_run = self.trigger()
        parser = Mock()
        deliver_workflow_result(
            feature_id="different_workflow",
            organization_id=self.organization.id,
            run_uuid=agent_run.run.uuid,
            status="completed",
            result={},
            error=None,
            parse_result=parser,
        )
        parser.assert_not_called()
        finish_workflow_run(
            agent_run.run_id,
            organization_id=self.organization.id,
            feature_id="different_workflow",
            error="Wrong workflow",
        )
        agent_run.refresh_from_db()
        assert agent_run.extras["status"] == "running"

    def test_callback_for_deleted_user_marks_run_failed(self) -> None:
        agent_run = self.trigger()
        agent_run.run.update(user_id=None)
        deliver_monitor_cleanup_result(
            self.organization.id, agent_run.run.uuid, "completed", self.result(), None
        )
        agent_run.refresh_from_db()
        assert agent_run.extras["status"] == "failed"
        assert agent_run.extras["error"] == "The triggering user no longer exists."

    def test_partial_project_marks_workflow_partial(self) -> None:
        agent_run = self.trigger()
        result = self.result()
        result["data"]["projects"][0]["scan_status"] = "partial"
        deliver_monitor_cleanup_result(
            self.organization.id, agent_run.run.uuid, "completed", result, None
        )
        agent_run.refresh_from_db()
        assert agent_run.extras["status"] == "partial"
        assert len(agent_run.extras["results"]) == 1

    def trigger(self):
        with self.feature(FEATURE):
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
