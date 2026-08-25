from collections.abc import Sequence
from unittest import mock

from django.db import connections
from django.test.utils import CaptureQueriesContext

from sentry import search
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnuba
from sentry.constants import ObjectStatus
from sentry.integrations.source_code_management.status_check import (
    AggregateChecksStatus,
    AggregateReviewStatus,
    FailedCheck,
    PullRequestFileSummary,
    PullRequestStatusClient,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.milestones import reconcile_milestones
from sentry.seer.models.run import SeerRunMilestoneType
from sentry.testutils.cases import APITestCase, SnubaTestCase
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


class OrganizationSeerAutofixOverviewTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-seer-autofix-overview"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def _run_for_group(self, group, description):
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", group=group, project=group.project)
        reconcile_milestones(run, _root_cause_state(description))
        return run

    def _group_with_events(self, fingerprint, *, events, users=1, minutes_ago=1):
        group = None
        for i in range(events):
            event = self.store_event(
                data={
                    "fingerprint": [fingerprint],
                    "timestamp": before_now(minutes=minutes_ago).isoformat(),
                    "user": {"id": str(i % users)},
                },
                project_id=self.project.id,
            )
            group = event.group
        assert group is not None
        return group

    def test_root_cause_run_grouped_under_root_cause_milestone(self):
        group = self.create_group()
        self._run_for_group(group, "the boom")
        resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]
        assert len(runs) == 1
        assert runs[0]["shortId"] == group.qualified_short_id
        assert runs[0]["rootCause"]["oneLineDescription"] == "the boom"
        assert runs[0]["proposedFix"] is None

    def _root_cause_short_ids(self, resp):
        return [r["shortId"] for r in resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]]

    def test_default_sort_orders_by_seer_recent_activity(self):
        older = self.create_group()
        newer = self.create_group()
        run_old = self._run_for_group(older, "old")
        run_new = self._run_for_group(newer, "new")
        run_old.update(last_triggered_at=before_now(minutes=10))
        run_new.update(last_triggered_at=before_now(minutes=1))

        resp = self.get_success_response(self.organization.slug)

        assert self._root_cause_short_ids(resp) == [
            newer.qualified_short_id,
            older.qualified_short_id,
        ]

    def test_invalid_sort_falls_back_to_default(self):
        group = self.create_group()
        self._run_for_group(group, "boom")

        resp = self.get_success_response(self.organization.slug, qs_params={"sort": "nonsense"})

        assert self._root_cause_short_ids(resp) == [group.qualified_short_id]

    def test_sort_events_orders_by_event_count(self):
        low = self._group_with_events("low", events=1)
        high = self._group_with_events("high", events=5)
        self._run_for_group(low, "low")
        self._run_for_group(high, "high")

        resp = self.get_success_response(self.organization.slug, qs_params={"sort": "events"})

        assert self._root_cause_short_ids(resp) == [
            high.qualified_short_id,
            low.qualified_short_id,
        ]

    def test_sort_users_orders_by_user_count(self):
        few = self._group_with_events("few", events=4, users=1)
        many = self._group_with_events("many", events=4, users=4)
        self._run_for_group(few, "few")
        self._run_for_group(many, "many")

        resp = self.get_success_response(self.organization.slug, qs_params={"sort": "users"})

        assert self._root_cause_short_ids(resp) == [
            many.qualified_short_id,
            few.qualified_short_id,
        ]

    def test_sort_issue_orders_by_most_recent_event(self):
        stale = self._group_with_events("stale", events=1, minutes_ago=60)
        fresh = self._group_with_events("fresh", events=1, minutes_ago=1)
        self._run_for_group(stale, "stale")
        self._run_for_group(fresh, "fresh")

        resp = self.get_success_response(self.organization.slug, qs_params={"sort": "issue"})

        assert self._root_cause_short_ids(resp) == [
            fresh.qualified_short_id,
            stale.qualified_short_id,
        ]

    @mock.patch(
        "sentry.seer.endpoints.organization_seer_autofix_overview._MAX_RUNS_PER_MILESTONE", 1
    )
    def test_events_sort_selects_correct_run_before_cap(self):
        # The high-event issue is the OLDEST seer run, so a cap-then-sort impl would drop it.
        high = self._group_with_events("high", events=5)
        low = self._group_with_events("low", events=1)
        run_high = self._run_for_group(high, "high")
        run_low = self._run_for_group(low, "low")
        run_high.update(last_triggered_at=before_now(minutes=60))
        run_low.update(last_triggered_at=before_now(minutes=1))

        resp = self.get_success_response(self.organization.slug, qs_params={"sort": "events"})

        assert self._root_cause_short_ids(resp) == [high.qualified_short_id]

    def test_issue_sort_raises_paginator_cap_to_candidate_count(self):
        # Without the max_limit override the paginator silently caps at 100 and
        # candidates beyond it would sort last; assert the endpoint raises it.
        low = self._group_with_events("low", events=1)
        high = self._group_with_events("high", events=2)
        self._run_for_group(low, "low")
        self._run_for_group(high, "high")

        with mock.patch(
            "sentry.seer.endpoints.organization_seer_autofix_overview.search.backend.query",
            wraps=search.backend.query,
        ) as mock_query:
            self.get_success_response(self.organization.slug, qs_params={"sort": "events"})

        assert mock_query.call_count == 1
        assert mock_query.call_args.kwargs["limit"] == 2
        assert mock_query.call_args.kwargs["paginator_options"] == {"max_limit": 2}

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

    def _code_changes_state(self, rc):
        from sentry.seer.agent.client_models import (
            AgentFilePatch,
            Artifact,
            DiffLine,
            FilePatch,
            Hunk,
            MemoryBlock,
            Message,
            SeerRunState,
        )

        patch = AgentFilePatch(
            repo_name="getsentry/sentry",
            patch=FilePatch(
                path="src/foo.py",
                type="M",
                added=1,
                removed=1,
                hunks=[
                    Hunk(
                        source_start=1,
                        source_length=1,
                        target_start=1,
                        target_length=1,
                        section_header="",
                        lines=[
                            DiffLine(
                                line_type="-",
                                value="old",
                                source_line_no=1,
                                target_line_no=None,
                                diff_line_no=1,
                            ),
                            DiffLine(
                                line_type="+",
                                value="new",
                                source_line_no=None,
                                target_line_no=1,
                                diff_line_no=2,
                            ),
                        ],
                    )
                ],
            ),
            diff="@@ -1 +1 @@\n-old\n+new",
        )
        return SeerRunState(
            run_id=1,
            blocks=[
                MemoryBlock(
                    id="b",
                    message=Message(role="assistant", content="c"),
                    timestamp="2026-02-10T00:00:00Z",
                    artifacts=[
                        Artifact(key="root_cause", data={"one_line_description": rc}, reason="r")
                    ],
                    merged_file_patches=[patch],
                )
            ],
            status="completed",
            updated_at="2026-02-10T00:00:00Z",
        )

    def _run_with_code_changes(self, group):
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", group=group, project=group.project)
        reconcile_milestones(run, self._code_changes_state("rc text"))
        return run

    def test_code_changes_returns_generated_diffs(self):
        group = self.create_group()
        self._run_with_code_changes(group)

        resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.CODE_CHANGES]
        assert len(runs) == 1
        files = runs[0]["codeChanges"]
        assert len(files) == 1
        assert files[0]["repoName"] == "getsentry/sentry"
        patch = files[0]["patch"]
        assert patch["path"] == "src/foo.py"
        assert patch["type"] == "M"
        assert patch["added"] == 1
        assert patch["removed"] == 1
        lines = patch["hunks"][0]["lines"]
        assert lines[0]["line_type"] == "-"
        assert lines[1]["line_type"] == "+"
        assert lines[1]["value"] == "new"

    def test_run_without_code_changes_has_empty_list(self):
        group = self.create_group()
        self._run_for_group(group, "no changes yet")

        resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]
        assert len(runs) == 1
        assert runs[0]["codeChanges"] == []

    def test_code_changes_excluded_once_a_pull_request_exists(self):
        group = self.create_group()
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", group=group, project=group.project)
        state = self._code_changes_state("rc text")
        state.blocks[0].pr_commit_shas = {"getsentry/sentry": "abc123"}
        reconcile_milestones(run, state)

        resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.HAS_PULL_REQUEST]
        assert len(runs) == 1
        assert runs[0]["codeChanges"] == []

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
        assert issue["assignedTo"] is None
        assert issue["owners"] == []

    def test_issue_stats_absent_issues_no_snuba_query(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        with mock.patch(
            "sentry.api.serializers.models.group."
            "GroupSerializerSnuba._execute_error_seen_stats_query",
            return_value={"data": []},
        ) as execute:
            resp = self.get_success_response(self.organization.slug)
        assert execute.call_count == 0
        issue = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]["issue"]
        assert issue["count"] is None
        assert issue["userCount"] is None
        assert issue["lastSeen"] is None

    def test_issue_stats_expand_requests_snuba_stats(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        with mock.patch(
            "sentry.seer.endpoints.organization_seer_autofix_overview.StreamGroupSerializerSnuba",
            wraps=StreamGroupSerializerSnuba,
        ) as serializer:
            self.get_success_response(self.organization.slug, qs_params={"expand": "issueStats"})
        assert "stats" not in serializer.call_args.kwargs["collapse"]

    def _pull_request_for_run(
        self, group, run, *, key="123", name="getsentry/sentry", integration_id=123, **updates
    ):
        repo = self.create_repo(
            project=group.project,
            name=name,
            provider="integrations:github",
            integration_id=integration_id,
            url=f"https://github.com/{name}",
        )
        pull_request = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id, key=key
        )
        pull_request.update(**updates)
        self.create_seer_run_pull_request(run=run, pull_request=pull_request)
        return pull_request

    def _run_with_pull_request_milestone(self, group):
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", group=group, project=group.project)
        state = self._code_changes_state("rc text")
        state.blocks[0].pr_commit_shas = {"getsentry/sentry": "abc123"}
        reconcile_milestones(run, state)
        return run

    def _set_provider_client(self, mock_get_integration, client):
        installation = mock.Mock()
        installation.get_client.return_value = client
        integration = mock.Mock()
        integration.get_installation.return_value = installation
        mock_get_integration.return_value = integration
        return client

    def _pull_requests(self, *, expand=None):
        kwargs = {"qs_params": {"expand": expand}} if expand is not None else {}
        resp = self.get_success_response(self.organization.slug, **kwargs)
        run_data = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]
        return run_data["pullRequests"]

    def _issue_project(self, resp, milestone=SeerRunMilestoneType.ROOT_CAUSE):
        return resp.data["runsByMilestone"][milestone][0]["issue"]["project"]

    def _projects_by_id(self, resp, milestone=SeerRunMilestoneType.ROOT_CAUSE):
        return {
            r["issue"]["project"]["id"]: r["issue"]["project"]
            for r in resp.data["runsByMilestone"][milestone]
        }

    def test_scm_info_marks_project_with_github_repo_eligible(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        repo = self.create_repo(self.project, provider="integrations:github")
        self.create_seer_project_repository(project=self.project, repository=repo)

        resp = self.get_success_response(self.organization.slug, qs_params={"expand": "scmInfo"})

        project = self._issue_project(resp)
        assert project.get("hasReposConnected") is True
        assert project.get("hasNonGithubRepo") is False

    def test_project_without_repos_is_not_eligible(self):
        group = self.create_group()
        self._run_for_group(group, "boom")

        resp = self.get_success_response(self.organization.slug, qs_params={"expand": "scmInfo"})

        project = self._issue_project(resp)
        assert project["hasReposConnected"] is False
        assert project["hasNonGithubRepo"] is False

    def test_non_github_repo_flags_has_non_github(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        repo = self.create_repo(self.project, provider="integrations:gitlab")
        self.create_seer_project_repository(project=self.project, repository=repo)

        with self.feature("organizations:seer-gitlab-support"):
            resp = self.get_success_response(
                self.organization.slug, qs_params={"expand": "scmInfo"}
            )

        project = self._issue_project(resp)
        assert project["hasReposConnected"] is True
        assert project["hasNonGithubRepo"] is True

    def test_eligibility_absent_without_scm_info_expand(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        repo = self.create_repo(self.project, provider="integrations:github")
        self.create_seer_project_repository(project=self.project, repository=repo)

        resp = self.get_success_response(self.organization.slug)

        project = self._issue_project(resp)
        assert "hasReposConnected" not in project
        assert "hasNonGithubRepo" not in project

    def test_github_enterprise_repo_is_github(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        repo = self.create_repo(self.project, provider="integrations:github_enterprise")
        self.create_seer_project_repository(project=self.project, repository=repo)

        resp = self.get_success_response(self.organization.slug, qs_params={"expand": "scmInfo"})

        project = self._issue_project(resp)
        assert project["hasReposConnected"] is True
        assert project["hasNonGithubRepo"] is False

    def test_mixed_github_and_gitlab_repos(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        gh = self.create_repo(self.project, provider="integrations:github")
        gl = self.create_repo(self.project, provider="integrations:gitlab")
        self.create_seer_project_repository(project=self.project, repository=gh)
        self.create_seer_project_repository(project=self.project, repository=gl)

        with self.feature("organizations:seer-gitlab-support"):
            resp = self.get_success_response(
                self.organization.slug, qs_params={"expand": "scmInfo"}
            )

        project = self._issue_project(resp)
        assert project["hasReposConnected"] is True
        assert project["hasNonGithubRepo"] is True

    def test_gitlab_repo_without_flag_is_not_connected(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        repo = self.create_repo(self.project, provider="integrations:gitlab")
        self.create_seer_project_repository(project=self.project, repository=repo)

        resp = self.get_success_response(self.organization.slug, qs_params={"expand": "scmInfo"})

        project = self._issue_project(resp)
        assert project["hasReposConnected"] is False
        assert project["hasNonGithubRepo"] is False

    def test_inactive_repo_is_not_connected(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        repo = self.create_repo(self.project, provider="integrations:github")
        repo.update(status=ObjectStatus.DISABLED)
        self.create_seer_project_repository(project=self.project, repository=repo)

        resp = self.get_success_response(self.organization.slug, qs_params={"expand": "scmInfo"})

        project = self._issue_project(resp)
        assert project["hasReposConnected"] is False
        assert project["hasNonGithubRepo"] is False

    def test_eligibility_is_keyed_per_project(self):
        eligible_group = self.create_group()
        self._run_for_group(eligible_group, "eligible")
        repo = self.create_repo(self.project, provider="integrations:github")
        self.create_seer_project_repository(project=self.project, repository=repo)

        other_project = self.create_project(organization=self.organization)
        ineligible_group = self.create_group(project=other_project)
        self._run_for_group(ineligible_group, "ineligible")

        resp = self.get_success_response(self.organization.slug, qs_params={"expand": "scmInfo"})

        projects = self._projects_by_id(resp)
        assert projects[str(self.project.id)]["hasReposConnected"] is True
        assert projects[str(other_project.id)]["hasReposConnected"] is False

    def test_repo_eligibility_is_one_query_regardless_of_project_count(self):
        for i in range(3):
            project = self.create_project(organization=self.organization)
            group = self.create_group(project=project)
            self._run_for_group(group, f"boom {i}")
            repo = self.create_repo(project, provider="integrations:github")
            self.create_seer_project_repository(project=project, repository=repo)

        with CaptureQueriesContext(connections["default"]) as ctx:
            self.get_success_response(self.organization.slug, qs_params={"expand": "scmInfo"})

        repo_queries = [q for q in ctx.captured_queries if "seer_projectrepository" in q["sql"]]
        assert len(repo_queries) == 1

    def _project_config_by_id(self, resp):
        return {entry["id"]: entry for entry in resp.data["projectConfig"]}

    def test_project_config_absent_without_expand(self):
        group = self.create_group()
        self._run_for_group(group, "boom")

        resp = self.get_success_response(self.organization.slug)

        assert "projectConfig" not in resp.data

    def test_project_config_returned_with_expand(self):
        group = self.create_group()
        self._run_for_group(group, "boom")

        resp = self.get_success_response(
            self.organization.slug, qs_params={"expand": "projectConfig"}
        )

        config = self._project_config_by_id(resp)
        assert config[str(self.project.id)] == {
            "id": str(self.project.id),
            "slug": self.project.slug,
            "hasReposConnected": False,
        }

    def test_project_config_includes_project_without_runs(self):
        repo = self.create_repo(self.project, provider="integrations:github")
        self.create_seer_project_repository(project=self.project, repository=repo)

        resp = self.get_success_response(
            self.organization.slug, qs_params={"expand": "projectConfig"}
        )

        assert resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE] == []
        config = self._project_config_by_id(resp)
        assert config[str(self.project.id)]["hasReposConnected"] is True

    def test_project_config_reflects_repo_connection_per_project(self):
        connected = self.create_project(organization=self.organization)
        repo = self.create_repo(connected, provider="integrations:github")
        self.create_seer_project_repository(project=connected, repository=repo)
        unconnected = self.create_project(organization=self.organization)

        resp = self.get_success_response(
            self.organization.slug, qs_params={"expand": "projectConfig"}
        )

        config = self._project_config_by_id(resp)
        assert config[str(connected.id)]["hasReposConnected"] is True
        assert config[str(unconnected.id)]["hasReposConnected"] is False

    def test_project_config_respects_project_filter(self):
        selected = self.create_project(organization=self.organization)
        other = self.create_project(organization=self.organization)

        resp = self.get_success_response(
            self.organization.slug,
            qs_params={"expand": "projectConfig", "project": selected.id},
        )

        config = self._project_config_by_id(resp)
        assert set(config) == {str(selected.id)}
        assert str(other.id) not in config

    def test_project_config_scopes_to_member_projects_by_default(self):
        org = self.create_organization(owner=self.create_user())
        member = self.create_user()
        my_team = self.create_team(organization=org)
        self.create_member(user=member, organization=org, teams=[my_team])
        mine = self.create_project(organization=org, teams=[my_team])
        other_team = self.create_team(organization=org)
        theirs = self.create_project(organization=org, teams=[other_team])
        self.login_as(member)

        resp = self.get_success_response(org.slug, qs_params={"expand": "projectConfig"})

        config = self._project_config_by_id(resp)
        assert str(mine.id) in config
        assert str(theirs.id) not in config

    def test_project_config_eligibility_is_one_query(self):
        for _ in range(3):
            project = self.create_project(organization=self.organization)
            repo = self.create_repo(project, provider="integrations:github")
            self.create_seer_project_repository(project=project, repository=repo)

        with CaptureQueriesContext(connections["default"]) as ctx:
            self.get_success_response(self.organization.slug, qs_params={"expand": "projectConfig"})

        repo_queries = [q for q in ctx.captured_queries if "seer_projectrepository" in q["sql"]]
        assert len(repo_queries) == 1

    def test_scm_info_and_project_config_share_one_eligibility_query(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        repo = self.create_repo(self.project, provider="integrations:github")
        self.create_seer_project_repository(project=self.project, repository=repo)

        with CaptureQueriesContext(connections["default"]) as ctx:
            resp = self.get_success_response(
                self.organization.slug, qs_params={"expand": ["scmInfo", "projectConfig"]}
            )

        repo_queries = [q for q in ctx.captured_queries if "seer_projectrepository" in q["sql"]]
        assert len(repo_queries) == 1
        assert self._issue_project(resp)["hasReposConnected"] is True
        assert self._project_config_by_id(resp)[str(self.project.id)]["hasReposConnected"] is True

    @mock.patch(_INTEGRATION_SERVICE)
    def test_run_includes_pull_requests(self, mock_get_integration):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        pull_request = self._pull_request_for_run(
            group, run, state=PullRequestLifecycleState.OPEN, draft=False
        )
        client = self._set_provider_client(
            mock_get_integration,
            PullRequestStatusClientFake(
                {"123": PullRequestStatusResult(checks=AggregateChecksStatus.SUCCESS)}
            ),
        )
        resp = self.get_success_response(self.organization.slug)
        run_data = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]
        # Default (no expand=scmInfo) must not call the SCM provider.
        assert client.requested_keys == []
        assert run_data["pullRequests"] == [
            {
                "id": str(pull_request.id),
                "number": 123,
                "url": "https://github.com/getsentry/sentry/pull/123",
                "status": "open",
                "checksStatus": None,
                "reviewStatus": None,
                "repoName": "getsentry/sentry",
                "files": [],
                "failedCheckDetails": [],
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

        pull_requests = self._pull_requests(expand="scmInfo")

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

        pull_requests = self._pull_requests(expand="scmInfo")

        assert pull_requests[0]["checksStatus"] == "success"
        assert pull_requests[0]["reviewStatus"] == "approved"
        assert pull_requests[0]["failedCheckDetails"] == []
        assert client.requested_keys == ["123"]

    @mock.patch(_INTEGRATION_SERVICE)
    def test_failing_pull_request_lists_failed_checks(self, mock_get_integration):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        self._pull_request_for_run(group, run, state=PullRequestLifecycleState.OPEN, draft=False)
        self._set_provider_client(
            mock_get_integration,
            PullRequestStatusClientFake(
                {
                    "123": PullRequestStatusResult(
                        checks=AggregateChecksStatus.FAILURE,
                        failed_checks=(
                            FailedCheck(
                                name="build (3.12)",
                                url="https://github.com/getsentry/sentry/runs/1",
                            ),
                            FailedCheck(name="mypy", url=None),
                        ),
                    )
                }
            ),
        )

        pull_requests = self._pull_requests(expand="scmInfo")

        assert pull_requests[0]["checksStatus"] == "failure"
        assert "failedChecks" not in pull_requests[0]
        assert pull_requests[0]["failedCheckDetails"] == [
            {"name": "build (3.12)", "url": "https://github.com/getsentry/sentry/runs/1"},
            {"name": "mypy", "url": None},
        ]

    @mock.patch(_INTEGRATION_SERVICE)
    def test_merged_pull_request_skips_provider_fetch(self, mock_get_integration):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        self._pull_request_for_run(
            group, run, state=PullRequestLifecycleState.MERGED, merged_at=before_now(days=1)
        )
        client = self._set_provider_client(mock_get_integration, PullRequestStatusClientFake())

        pull_requests = self._pull_requests(expand="scmInfo")

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

        pull_requests = self._pull_requests(expand="scmInfo")

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

        pull_requests = self._pull_requests(expand="scmInfo")

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

        pull_requests = self._pull_requests(expand="scmInfo")

        # A disconnected repo is skipped: no provider call, no url, null enrichment.
        assert client.requested_keys == []
        assert pull_requests[0]["url"] is None
        assert pull_requests[0]["checksStatus"] is None
        assert pull_requests[0]["repoName"] is None

    def test_run_without_pull_requests_has_empty_list(self):
        group = self.create_group()
        self._run_for_group(group, "boom")
        resp = self.get_success_response(self.organization.slug)
        run_data = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]
        assert run_data["pullRequests"] == []

    def test_closed_pull_request_is_excluded_from_the_list(self):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        self._pull_request_for_run(group, run, state=PullRequestLifecycleState.CLOSED)
        resp = self.get_success_response(self.organization.slug)
        run_data = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]
        assert run_data["pullRequests"] == []

    def test_unenriched_pull_request_is_kept_in_the_list(self):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        pull_request = self._pull_request_for_run(group, run, state=None)
        resp = self.get_success_response(self.organization.slug)
        run_data = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]
        assert [pr["id"] for pr in run_data["pullRequests"]] == [str(pull_request.id)]

    def test_run_with_only_closed_pull_request_is_hidden(self):
        group = self.create_group()
        run = self._run_with_pull_request_milestone(group)
        self._pull_request_for_run(group, run, state=PullRequestLifecycleState.CLOSED)
        resp = self.get_success_response(self.organization.slug)
        assert resp.data["runsByMilestone"][SeerRunMilestoneType.HAS_PULL_REQUEST] == []

    def test_run_with_only_unenriched_pull_request_is_shown(self):
        group = self.create_group()
        run = self._run_with_pull_request_milestone(group)
        self._pull_request_for_run(group, run, state=None)
        resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.HAS_PULL_REQUEST]
        assert len(runs) == 1

    def test_run_with_open_and_closed_pull_requests_shows_only_open(self):
        group = self.create_group()
        run = self._run_with_pull_request_milestone(group)
        self._pull_request_for_run(group, run, state=PullRequestLifecycleState.CLOSED)
        open_pr = self._pull_request_for_run(
            group,
            run,
            key="456",
            name="getsentry/other",
            integration_id=456,
            state=PullRequestLifecycleState.OPEN,
            draft=False,
        )
        resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.HAS_PULL_REQUEST]
        assert len(runs) == 1
        assert [pr["id"] for pr in runs[0]["pullRequests"]] == [str(open_pr.id)]

    @mock.patch(
        "sentry.seer.endpoints.organization_seer_autofix_overview._MAX_RUNS_PER_MILESTONE", 1
    )
    def test_closed_pull_request_run_is_dropped_before_the_cap(self):
        open_group = self.create_group()
        open_run = self._run_with_pull_request_milestone(open_group)
        open_run.update(last_triggered_at=before_now(minutes=5))
        open_pr = self._pull_request_for_run(
            open_group, open_run, state=PullRequestLifecycleState.OPEN, draft=False
        )

        closed_group = self.create_group()
        closed_run = self._run_with_pull_request_milestone(closed_group)
        closed_run.update(last_triggered_at=before_now(minutes=1))
        self._pull_request_for_run(
            closed_group,
            closed_run,
            key="456",
            name="getsentry/other",
            integration_id=456,
            state=PullRequestLifecycleState.CLOSED,
        )

        resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.HAS_PULL_REQUEST]
        # Cap is 1 and the closed-PR run is newest; dropping it before the cap
        # keeps the older open-PR run instead of yielding an empty section.
        assert len(runs) == 1
        assert [pr["id"] for pr in runs[0]["pullRequests"]] == [str(open_pr.id)]

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

    @mock.patch(
        "sentry.seer.endpoints.organization_seer_autofix_overview._MAX_RUNS_PER_MILESTONE", 2
    )
    def test_truncated_milestones_reports_capped_sections(self):
        for i in range(3):
            self._run_for_group(self.create_group(), f"boom {i}")

        resp = self.get_success_response(self.organization.slug)

        assert resp.data["truncatedMilestones"] == [SeerRunMilestoneType.ROOT_CAUSE]

    def test_truncated_milestones_empty_when_under_cap(self):
        self._run_for_group(self.create_group(), "boom")

        resp = self.get_success_response(self.organization.slug)

        assert resp.data["truncatedMilestones"] == []

    @mock.patch(_INTEGRATION_SERVICE)
    def test_both_expands_enrich_pull_request_and_request_stats(self, mock_get_integration):
        group = self.create_group()
        run = self._run_for_group(group, "boom")
        self._pull_request_for_run(group, run, state=PullRequestLifecycleState.OPEN, draft=False)
        client = self._set_provider_client(
            mock_get_integration,
            PullRequestStatusClientFake(
                {"123": PullRequestStatusResult(checks=AggregateChecksStatus.SUCCESS)}
            ),
        )
        with mock.patch(
            "sentry.seer.endpoints.organization_seer_autofix_overview.StreamGroupSerializerSnuba",
            wraps=StreamGroupSerializerSnuba,
        ) as serializer:
            pull_requests = self._pull_requests(expand=["scmInfo", "issueStats"])
        assert client.requested_keys == ["123"]
        assert pull_requests[0]["checksStatus"] == "success"
        assert "stats" not in serializer.call_args.kwargs["collapse"]


class OrganizationSeerAutofixOverviewStatusExpandTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-seer-autofix-overview"
    _FETCH = "sentry.seer.endpoints.organization_seer_autofix_overview.fetch_run_statuses"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def _run_for_group(self, group, description, state_id):
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", group=group, project=group.project)
        reconcile_milestones(run, _root_cause_state(description))
        run.update(seer_run_state_id=state_id)
        return run

    def _root_cause_runs(self, resp):
        return resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]

    def test_status_absent_without_expand(self):
        group = self.create_group()
        self._run_for_group(group, "boom", state_id=101)
        with mock.patch(self._FETCH) as m:
            resp = self.get_success_response(self.organization.slug)
        assert m.call_count == 0
        assert self._root_cause_runs(resp)[0]["status"] is None

    def test_expand_status_attaches_status_by_state_id(self):
        group = self.create_group()
        run = self._run_for_group(group, "boom", state_id=101)
        with mock.patch(self._FETCH, return_value={101: "processing"}) as m:
            resp = self.get_success_response(self.organization.slug, qs_params={"expand": "status"})
        assert m.call_args.args[0] == [101]
        serialized = self._root_cause_runs(resp)[0]
        assert serialized["seerRunId"] == str(run.uuid)
        assert serialized["status"] == "processing"

    def test_expand_status_run_without_state_id_gets_null(self):
        group = self.create_group()
        self._run_for_group(group, "boom", state_id=None)
        with mock.patch(self._FETCH, return_value={}) as m:
            resp = self.get_success_response(self.organization.slug, qs_params={"expand": "status"})
        assert m.call_args.args[0] == []
        assert self._root_cause_runs(resp)[0]["status"] is None
