from __future__ import annotations

from collections.abc import Sequence
from unittest import mock

from sentry.integrations.source_code_management.status_check import (
    AggregateChecksStatus,
    AggregateReviewStatus,
    PullRequestFileSummary,
    PullRequestStatusClient,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.testutils.cases import APITestCase

_INTEGRATION_SERVICE = (
    "sentry.integrations.source_code_management.pull_request_status_batch."
    "integration_service.get_integration"
)


class PullRequestStatusClientFake(PullRequestStatusClient):
    def __init__(self, status_by_key: dict[str, PullRequestStatusResult] | None = None) -> None:
        self.status_by_key = status_by_key or {}
        self.requested_keys: list[str] = []

    def get_pull_request_statuses(
        self, pull_requests: Sequence[PullRequestStatusRequest]
    ) -> dict[PullRequestStatusRequest, PullRequestStatusResult]:
        self.requested_keys.extend(pr.pull_number for pr in pull_requests)
        return {
            pr: self.status_by_key.get(pr.pull_number, PullRequestStatusResult())
            for pr in pull_requests
        }


class OrganizationSeerAutofixScmInfoTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-autofix-scm-info"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def _set_provider_client(self, mock_get_integration, client):
        installation = mock.Mock()
        installation.get_client.return_value = client
        integration = mock.Mock()
        integration.get_installation.return_value = installation
        mock_get_integration.return_value = integration
        return client

    def _run(self, *, organization=None, project=None, source="autofix"):
        organization = organization or self.organization
        project = project or self.project
        group = self.create_group(project=project)
        run = self.create_seer_run(organization=organization)
        self.create_seer_agent_run(run, source=source, group=group, project=project)
        return run, group

    def _add_pr(self, run, group, *, key="123", updates=None):
        repo = self.create_repo(
            project=group.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=123,
            url="https://github.com/getsentry/sentry",
        )
        pr = self.create_pull_request(
            repository_id=repo.id, organization_id=group.project.organization_id, key=key
        )
        pr.update(**(updates or {"state": PullRequestLifecycleState.OPEN, "draft": False}))
        self.create_seer_run_pull_request(run=run, pull_request=pr)
        return pr

    def _get(self, run_ids):
        return self.get_success_response(self.organization.slug, qs_params={"runIds": run_ids})

    @mock.patch(_INTEGRATION_SERVICE)
    def test_returns_scm_info_for_run(self, mock_get_integration):
        run, group = self._run()
        pr = self._add_pr(run, group)
        client = self._set_provider_client(
            mock_get_integration,
            PullRequestStatusClientFake(
                {
                    "123": PullRequestStatusResult(
                        checks=AggregateChecksStatus.SUCCESS,
                        review=AggregateReviewStatus.APPROVED,
                        files=(
                            PullRequestFileSummary(
                                path="src/foo.py",
                                additions=10,
                                deletions=2,
                                change_type="MODIFIED",
                            ),
                        ),
                    )
                }
            ),
        )

        resp = self._get(str(run.uuid))

        assert client.requested_keys == ["123"]
        assert resp.data["scmInfoByRunId"] == {
            str(run.uuid): {
                "pullRequests": [
                    {
                        "id": str(pr.id),
                        "number": 123,
                        "url": "https://github.com/getsentry/sentry/pull/123",
                        "status": "open",
                        "checksStatus": "success",
                        "reviewStatus": "approved",
                        "repoName": "getsentry/sentry",
                        "files": [
                            {
                                "path": "src/foo.py",
                                "additions": 10,
                                "deletions": 2,
                                "changeType": "MODIFIED",
                            }
                        ],
                        "failedCheckDetails": [],
                    }
                ]
            }
        }

    def test_run_without_prs_returns_empty_list(self):
        run, _ = self._run()
        resp = self._get(str(run.uuid))
        assert resp.data["scmInfoByRunId"] == {str(run.uuid): {"pullRequests": []}}

    def test_no_run_ids_returns_empty(self):
        resp = self._get([])
        assert resp.data == {"scmInfoByRunId": {}}

    def test_invalid_run_ids_returns_400(self):
        self.get_error_response(
            self.organization.slug, qs_params={"runIds": "not-a-uuid"}, status_code=400
        )

    def test_omits_runs_from_other_orgs(self):
        other_org = self.create_organization(owner=self.create_user())
        other_project = self.create_project(organization=other_org)
        other_run, other_group = self._run(organization=other_org, project=other_project)
        self._add_pr(other_run, other_group)
        resp = self._get(str(other_run.uuid))
        assert resp.data["scmInfoByRunId"] == {}

    def test_omits_runs_from_inaccessible_same_org_projects(self):
        org = self.create_organization(owner=self.create_user())
        member = self.create_user()
        my_team = self.create_team(organization=org)
        self.create_member(user=member, organization=org, teams=[my_team])
        self.create_project(organization=org, teams=[my_team])
        other_team = self.create_team(organization=org)
        inaccessible = self.create_project(organization=org, teams=[other_team])
        run, group = self._run(organization=org, project=inaccessible)
        self._add_pr(run, group)
        self.login_as(member)

        resp = self.get_success_response(org.slug, qs_params={"runIds": str(run.uuid)})
        assert resp.data["scmInfoByRunId"] == {}

    def test_omits_non_autofix_source_runs(self):
        run, group = self._run(source="explorer")
        self._add_pr(run, group)
        resp = self._get(str(run.uuid))
        assert resp.data["scmInfoByRunId"] == {}
