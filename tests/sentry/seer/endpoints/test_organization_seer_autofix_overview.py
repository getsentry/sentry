from collections.abc import Sequence
from unittest import mock

from sentry.constants import ObjectStatus
from sentry.integrations.source_code_management.status_check import (
    AggregateChecksStatus,
    AggregateReviewStatus,
    PullRequestFileSummary,
    PullRequestStatusClient,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.milestones import reconcile_milestones
from sentry.seer.models.run import SeerRunMilestoneType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.types.group import PriorityLevel

_INTEGRATION_SERVICE = (
    "sentry.integrations.source_code_management.pull_request_status_batch."
    "integration_service.get_integration"
)


class PullRequestStatusClientFake(PullRequestStatusClient):
    def __init__(
        self,
        status_by_key: dict[str, PullRequestStatusResult] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.status_by_key = status_by_key or {}
        self.error = error
        self.requested_keys: list[str] = []
        self.requested_include_files: list[bool] = []

    def get_pull_request_statuses(
        self, pull_requests: Sequence[PullRequestStatusRequest]
    ) -> dict[PullRequestStatusRequest, PullRequestStatusResult]:
        self.requested_keys.extend(pull_request.pull_number for pull_request in pull_requests)
        self.requested_include_files.extend(
            pull_request.include_files for pull_request in pull_requests
        )
        if self.error is not None:
            raise self.error
        return {
            pull_request: self.status_by_key.get(
                pull_request.pull_number, PullRequestStatusResult()
            )
            for pull_request in pull_requests
        }


def _root_cause_state(description):
    from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState

    return SeerRunState(
        run_id=1,
        blocks=[
            MemoryBlock(
                id="b",
                message=Message(role="assistant", content="c"),
                timestamp="2026-02-10T00:00:00Z",
                artifacts=[
                    Artifact(
                        key="root_cause", data={"one_line_description": description}, reason="r"
                    )
                ],
            )
        ],
        status="completed",
        updated_at="2026-02-10T00:00:00Z",
    )


class OrganizationSeerAutofixOverviewTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-autofix-overview"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def _run_for_group(self, group, description):
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", group=group, project=group.project)
        reconcile_milestones(run, _root_cause_state(description))
        return run

    def test_root_cause_run_grouped_under_root_cause_milestone(self):
        group = self.create_group()
        self._run_for_group(group, "the boom")
        resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]
        assert len(runs) == 1
        assert runs[0]["shortId"] == group.qualified_short_id
        assert runs[0]["rootCause"]["oneLineDescription"] == "the boom"
        assert runs[0]["proposedFix"] is None

    def _solution_state(self, rc, sol):
        from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState

        return SeerRunState(
            run_id=1,
            blocks=[
                MemoryBlock(
                    id="b",
                    message=Message(role="assistant", content="c"),
                    timestamp="2026-02-10T00:00:00Z",
                    artifacts=[
                        Artifact(key="root_cause", data={"one_line_description": rc}, reason="r"),
                        Artifact(key="solution", data={"one_line_summary": sol}, reason="r"),
                    ],
                )
            ],
            status="completed",
            updated_at="2026-02-10T00:00:00Z",
        )

    def test_solution_run_grouped_under_solution_milestone_with_both_texts(self):
        group = self.create_group()
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", group=group, project=group.project)
        reconcile_milestones(run, self._solution_state("rc text", "fix text"))
        resp = self.get_success_response(self.organization.slug)
        runs_by_milestone = resp.data["runsByMilestone"]
        assert runs_by_milestone[SeerRunMilestoneType.ROOT_CAUSE] == []
        runs = runs_by_milestone[SeerRunMilestoneType.SOLUTION]
        assert len(runs) == 1
        assert runs[0]["rootCause"]["oneLineDescription"] == "rc text"
        assert runs[0]["proposedFix"]["oneLineSummary"] == "fix text"

    def test_only_latest_run_per_group_is_shown(self):
        group = self.create_group()
        self._run_for_group(group, "old run")
        self._run_for_group(group, "new run")
        resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]
        assert len(runs) == 1
        assert runs[0]["rootCause"]["oneLineDescription"] == "new run"

    def test_inaccessible_project_is_excluded(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_group = self.create_group(project=other_project)
        run = self.create_seer_run(organization=other_org)
        self.create_seer_agent_run(run, source="autofix", group=other_group, project=other_project)
        reconcile_milestones(run, _root_cause_state("hidden"))
        resp = self.get_success_response(self.organization.slug)
        assert resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE] == []

    def test_deleted_group_id_is_tolerated(self):
        group = self.create_group()
        self._run_for_group(group, "gone")
        group.delete()
        resp = self.get_success_response(self.organization.slug)
        # Stale group id points at a deleted group; run is skipped, no 500.
        assert resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE] == []

    def test_run_includes_nested_issue_object(self):
        group = self.create_group(priority=PriorityLevel.HIGH)
        self._run_for_group(group, "the boom")
        resp = self.get_success_response(self.organization.slug)
        issue = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]["issue"]
        assert issue["project"]["id"] == str(group.project_id)
        assert issue["project"]["slug"] == group.project.slug
        assert issue["priority"] == "high"
        assert "count" in issue
        assert "userCount" in issue
        assert "lastSeen" in issue
        assert issue["assignedTo"] is None
        assert issue["owners"] == []

    def _pull_request_for_run(self, group, run, *, key="123", **updates):
        repo = self.create_repo(
            project=group.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=123,
            url="https://github.com/getsentry/sentry",
        )
        pull_request = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id, key=key
        )
        pull_request.update(**updates)
        self.create_seer_run_pull_request(run=run, pull_request=pull_request)
        return pull_request

    def _set_provider_client(self, mock_get_integration, client):
        installation = mock.Mock()
        installation.get_client.return_value = client
        integration = mock.Mock()
        integration.get_installation.return_value = installation
        mock_get_integration.return_value = integration
        return client

    def _pull_requests(self):
        resp = self.get_success_response(self.organization.slug)
        run_data = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]
        return run_data["pullRequests"]

    def test_run_includes_pull_requests(self):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        self._pull_request_for_run(group, run, state=PullRequestLifecycleState.OPEN, draft=False)
        resp = self.get_success_response(self.organization.slug)
        run_data = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]
        assert run_data["pullRequests"] == [
            {
                "number": 123,
                "url": "https://github.com/getsentry/sentry/pull/123",
                "status": "open",
                "checksStatus": None,
                "reviewStatus": None,
                "files": [],
            }
        ]

    @mock.patch(_INTEGRATION_SERVICE)
    def test_open_pull_request_includes_changed_files(self, mock_get_integration):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        self._pull_request_for_run(group, run, state=PullRequestLifecycleState.OPEN, draft=False)
        client = self._set_provider_client(
            mock_get_integration,
            PullRequestStatusClientFake(
                {
                    "123": PullRequestStatusResult(
                        files=(
                            PullRequestFileSummary(
                                path="src/sentry/foo.py",
                                additions=10,
                                deletions=2,
                                change_type="MODIFIED",
                            ),
                            PullRequestFileSummary(
                                path="src/sentry/bar.py",
                                additions=3,
                                deletions=0,
                                change_type="ADDED",
                            ),
                        )
                    )
                }
            ),
        )

        pull_requests = self._pull_requests()

        assert pull_requests[0]["files"] == [
            {
                "path": "src/sentry/foo.py",
                "additions": 10,
                "deletions": 2,
                "changeType": "MODIFIED",
            },
            {"path": "src/sentry/bar.py", "additions": 3, "deletions": 0, "changeType": "ADDED"},
        ]
        assert client.requested_include_files == [True]

    @mock.patch(_INTEGRATION_SERVICE)
    def test_open_pull_request_includes_checks_and_review(self, mock_get_integration):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        self._pull_request_for_run(group, run, state=PullRequestLifecycleState.OPEN, draft=False)
        client = self._set_provider_client(
            mock_get_integration,
            PullRequestStatusClientFake(
                {
                    "123": PullRequestStatusResult(
                        checks=AggregateChecksStatus.SUCCESS,
                        review=AggregateReviewStatus.APPROVED,
                    )
                }
            ),
        )

        pull_requests = self._pull_requests()

        assert pull_requests[0]["checksStatus"] == "success"
        assert pull_requests[0]["reviewStatus"] == "approved"
        assert client.requested_keys == ["123"]

    @mock.patch(_INTEGRATION_SERVICE)
    def test_merged_pull_request_skips_provider_fetch(self, mock_get_integration):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        self._pull_request_for_run(
            group, run, state=PullRequestLifecycleState.MERGED, merged_at=before_now(days=1)
        )
        client = self._set_provider_client(mock_get_integration, PullRequestStatusClientFake())

        pull_requests = self._pull_requests()

        assert pull_requests[0]["status"] == "merged"
        assert pull_requests[0]["checksStatus"] is None
        assert pull_requests[0]["reviewStatus"] is None
        assert client.requested_keys == []

    @mock.patch(_INTEGRATION_SERVICE)
    def test_provider_failure_degrades_to_null_statuses(self, mock_get_integration):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        self._pull_request_for_run(group, run, state=PullRequestLifecycleState.OPEN, draft=False)
        self._set_provider_client(
            mock_get_integration, PullRequestStatusClientFake(error=RuntimeError("nope"))
        )

        pull_requests = self._pull_requests()

        assert pull_requests[0]["number"] == 123
        assert pull_requests[0]["status"] == "open"
        assert pull_requests[0]["checksStatus"] is None
        assert pull_requests[0]["reviewStatus"] is None

    def test_unregistered_repository_provider_yields_null_url(self):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        repo = self.create_repo(
            project=group.project,
            name="getsentry/sentry",
            provider="integrations:custom_scm",
            integration_id=123,
            url="https://github.com/getsentry/sentry",
        )
        pull_request = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id, key="123"
        )
        pull_request.update(state=PullRequestLifecycleState.MERGED, merged_at=before_now(days=1))
        self.create_seer_run_pull_request(run=run, pull_request=pull_request)

        resp = self.get_success_response(self.organization.slug)

        pull_requests = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0][
            "pullRequests"
        ]
        assert pull_requests[0]["url"] is None

    @mock.patch(_INTEGRATION_SERVICE)
    def test_non_ascii_digit_key_does_not_poison_integration_batch(self, mock_get_integration):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        repo = self.create_repo(
            project=group.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=123,
            url="https://github.com/getsentry/sentry",
        )
        # "²".isdigit() is True but int("²") raises; the batch guard must match int().
        for key in ("123", "²"):
            pull_request = self.create_pull_request(
                repository_id=repo.id, organization_id=self.organization.id, key=key
            )
            pull_request.update(state=PullRequestLifecycleState.OPEN, draft=False)
            self.create_seer_run_pull_request(run=run, pull_request=pull_request)
        client = self._set_provider_client(
            mock_get_integration,
            PullRequestStatusClientFake(
                {"123": PullRequestStatusResult(checks=AggregateChecksStatus.SUCCESS)}
            ),
        )

        pull_requests = self._pull_requests()

        assert client.requested_keys == ["123"]
        assert [pr["number"] for pr in pull_requests] == [123]
        assert pull_requests[0]["checksStatus"] == "success"

    @mock.patch(_INTEGRATION_SERVICE)
    def test_pull_request_on_inactive_repo_is_not_enriched(self, mock_get_integration):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        repo = self.create_repo(
            project=group.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=123,
            url="https://github.com/getsentry/sentry",
        )
        repo.update(status=ObjectStatus.PENDING_DELETION)
        pull_request = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id, key="123"
        )
        pull_request.update(state=PullRequestLifecycleState.OPEN, draft=False)
        self.create_seer_run_pull_request(run=run, pull_request=pull_request)
        client = self._set_provider_client(
            mock_get_integration,
            PullRequestStatusClientFake(
                {"123": PullRequestStatusResult(checks=AggregateChecksStatus.SUCCESS)}
            ),
        )

        pull_requests = self._pull_requests()

        # A disconnected repo is skipped: no provider call, no url, null enrichment.
        assert client.requested_keys == []
        assert pull_requests[0]["url"] is None
        assert pull_requests[0]["checksStatus"] is None

    def test_run_without_pull_requests_has_empty_list(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        resp = self.get_success_response(self.organization.slug)
        run_data = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]
        assert run_data["pullRequests"] == []

    def test_runs_outside_stats_period_are_excluded(self):
        recent = self.create_group()
        self._run_for_group(recent, "recent boom")
        old = self.create_group()
        old_run = self._run_for_group(old, "old boom")
        old_run.update(last_triggered_at=before_now(days=30))

        resp = self.get_success_response(self.organization.slug, qs_params={"statsPeriod": "14d"})

        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]
        assert [r["shortId"] for r in runs] == [recent.qualified_short_id]

    @mock.patch(
        "sentry.seer.endpoints.organization_seer_autofix_overview._MAX_RUNS_PER_MILESTONE", 2
    )
    def test_section_is_capped_at_max_runs_per_milestone(self):
        for i in range(3):
            self._run_for_group(self.create_group(), f"boom {i}")

        resp = self.get_success_response(self.organization.slug)

        assert len(resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]) == 2
