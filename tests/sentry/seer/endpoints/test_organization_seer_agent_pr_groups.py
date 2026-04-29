from unittest.mock import MagicMock, patch

import requests
from django.urls import reverse

from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:seer-explorer")
class TestOrganizationSeerExplorerPRGroupsEndpoint(APITestCase):
    endpoint = "sentry-api-0-organization-seer-explorer-pr-groups"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = reverse(self.endpoint, args=[self.organization.slug])
        self.login_as(user=self.user)

        self.seer_access_patcher = patch(
            "sentry.seer.explorer.client_utils.has_seer_explorer_access_with_detail",
            return_value=(True, None),
        )
        self.seer_access_patcher.start()

        self.client_patcher = patch(
            "sentry.seer.endpoints.organization_seer_explorer_pr_groups.SeerExplorerClient"
        )
        self.mock_client_class = self.client_patcher.start()
        self.mock_client = MagicMock()
        self.mock_client_class.return_value = self.mock_client

        self.serialize_patcher = patch(
            "sentry.seer.endpoints.organization_seer_explorer_pr_groups.serialize"
        )
        self.mock_serialize = self.serialize_patcher.start()

    def tearDown(self) -> None:
        self.seer_access_patcher.stop()
        self.client_patcher.stop()
        self.serialize_patcher.stop()
        super().tearDown()

    def _make_seer_item(
        self,
        group_id,
        run_id=100,
        user_id=1,
        created_at="2025-01-15T00:00:00Z",
        repo_pr_states=None,
        title="test run",
    ):
        raw_pr_states = repo_pr_states or {}

        # Build mock RepoPRState objects so attribute access works
        mock_pr_states: dict[str, MagicMock] = {}
        for repo_name, state in raw_pr_states.items():
            mock_state = MagicMock()
            mock_state.repo_name = state.get("repo_name", repo_name)
            mock_state.branch_name = state.get("branch_name")
            mock_state.pr_number = state.get("pr_number")
            mock_state.pr_url = state.get("pr_url")
            mock_state.pr_creation_status = state.get("pr_creation_status")
            mock_pr_states[repo_name] = mock_state

        mock_run = MagicMock()
        mock_run.run_id = run_id
        mock_run.group_id = group_id
        mock_run.user_id = user_id
        mock_run.title = title
        mock_run.created_at = created_at
        mock_run.last_triggered_at = created_at
        mock_run.repo_pr_states = mock_pr_states if mock_pr_states else {}
        mock_run.__bool__ = lambda self: True
        return mock_run

    def test_get_returns_issues_with_pr_data(self) -> None:
        group = self.create_group(project=self.project)
        seer_item = self._make_seer_item(
            group_id=group.id,
            run_id=42,
            created_at="2025-01-15T12:00:00Z",
            repo_pr_states={
                "getsentry/sentry": {
                    "repo_name": "getsentry/sentry",
                    "branch_name": "fix/auth-bug",
                    "pr_number": 1234,
                    "pr_url": "https://github.com/getsentry/sentry/pull/1234",
                    "pr_creation_status": "created",
                }
            },
        )
        self.mock_client.get_runs.return_value = [seer_item]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Test Issue"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["runId"] == 42
        assert data[0]["userId"] == 1
        assert data[0]["createdAt"] == "2025-01-15T12:00:00Z"
        assert data[0]["repoPrStates"] == {
            "getsentry/sentry": {
                "repoName": "getsentry/sentry",
                "branchName": "fix/auth-bug",
                "prNumber": 1234,
                "prUrl": "https://github.com/getsentry/sentry/pull/1234",
                "prCreationStatus": "created",
            }
        }
        assert data[0]["group"]["id"] == str(group.id)
        assert data[0]["group"]["title"] == "Test Issue"
        self.mock_client_class.assert_called_once()

    def test_get_empty_seer_response(self) -> None:
        self.mock_client.get_runs.return_value = []

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        assert response.json()["data"] == []
        self.mock_serialize.assert_not_called()

    def test_get_filters_by_project_id(self) -> None:
        """Groups not matching the requested project_id are excluded from the DB query,
        but the run is still returned with group=None."""
        group_in_project = self.create_group(project=self.project)
        other_project = self.create_project(organization=self.organization)
        group_in_other_project = self.create_group(project=other_project)

        self.mock_client.get_runs.return_value = [
            self._make_seer_item(group_id=group_in_project.id, run_id=1),
            self._make_seer_item(group_id=group_in_other_project.id, run_id=2),
        ]
        self.mock_serialize.return_value = [{"id": str(group_in_project.id), "title": "In Project"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 2
        assert data[0]["group"]["id"] == str(group_in_project.id)
        assert data[1]["group"] is None

    def test_get_multiple_projects(self) -> None:
        """Passing multiple ?project= params returns groups from all requested projects."""
        project2 = self.create_project(organization=self.organization)
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=project2)

        self.mock_client.get_runs.return_value = [
            self._make_seer_item(group_id=group1.id, run_id=1),
            self._make_seer_item(group_id=group2.id, run_id=2),
        ]
        self.mock_serialize.return_value = [
            {"id": str(group1.id), "title": "Issue 1"},
            {"id": str(group2.id), "title": "Issue 2"},
        ]

        response = self.client.get(self.url + f"?project={self.project.id}&project={project2.id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 2
        returned_ids = {d["group"]["id"] for d in data}
        assert returned_ids == {str(group1.id), str(group2.id)}

    def test_get_no_matching_groups_returns_null_group(self) -> None:
        """When Seer returns group IDs that don't exist in the requested project, group is None."""
        self.mock_client.get_runs.return_value = [self._make_seer_item(group_id=999999)]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["group"] is None

    def test_get_includes_null_group_id_runs(self) -> None:
        """Runs without a group_id are included with group=None."""
        group = self.create_group(project=self.project)

        self.mock_client.get_runs.return_value = [
            self._make_seer_item(group_id=group.id, run_id=1),
            self._make_seer_item(group_id=None, run_id=2),
        ]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Issue 1"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 2
        assert data[0]["group"]["id"] == str(group.id)
        assert data[1]["group"] is None

    def test_get_seer_permission_error(self) -> None:
        self.mock_client_class.side_effect = SeerPermissionError("Feature flag not enabled")

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 403
        assert response.data == {"detail": "Feature flag not enabled"}

    def test_get_seer_api_http_error(self) -> None:
        """An HTTPError from the Seer API bubbles up to the global handler (500)."""
        self.mock_client.get_runs.side_effect = requests.HTTPError("Seer API Error")

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 500

    def test_get_multiple_groups_with_pr_data(self) -> None:
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)

        self.mock_client.get_runs.return_value = [
            self._make_seer_item(group_id=group1.id, run_id=10),
            self._make_seer_item(group_id=group2.id, run_id=20),
        ]
        self.mock_serialize.return_value = [
            {"id": str(group1.id), "title": "Issue 1"},
            {"id": str(group2.id), "title": "Issue 2"},
        ]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 2
        assert data[0]["runId"] == 10
        assert data[1]["runId"] == 20

    def test_get_repo_pr_states_with_missing_optional_fields(self) -> None:
        """Optional fields in repo_pr_states should gracefully be None."""
        group = self.create_group(project=self.project)
        seer_item = self._make_seer_item(
            group_id=group.id,
            repo_pr_states={
                "getsentry/sentry": {
                    "repo_name": "getsentry/sentry",
                }
            },
        )
        self.mock_client.get_runs.return_value = [seer_item]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Test"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        pr_states = response.json()["data"][0]["repoPrStates"]
        assert pr_states["getsentry/sentry"]["repoName"] == "getsentry/sentry"
        assert pr_states["getsentry/sentry"]["branchName"] is None
        assert pr_states["getsentry/sentry"]["prNumber"] is None
        assert pr_states["getsentry/sentry"]["prUrl"] is None
        assert pr_states["getsentry/sentry"]["prCreationStatus"] is None

    def test_get_multiple_repos_in_pr_states(self) -> None:
        group = self.create_group(project=self.project)
        seer_item = self._make_seer_item(
            group_id=group.id,
            repo_pr_states={
                "getsentry/sentry": {
                    "repo_name": "getsentry/sentry",
                    "branch_name": "fix/bug-a",
                    "pr_number": 100,
                    "pr_url": "https://github.com/getsentry/sentry/pull/100",
                    "pr_creation_status": "created",
                },
                "getsentry/relay": {
                    "repo_name": "getsentry/relay",
                    "branch_name": "fix/bug-b",
                    "pr_number": 200,
                    "pr_url": "https://github.com/getsentry/relay/pull/200",
                    "pr_creation_status": "creating",
                },
            },
        )
        self.mock_client.get_runs.return_value = [seer_item]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Test"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        pr_states = response.json()["data"][0]["repoPrStates"]
        assert len(pr_states) == 2
        assert pr_states["getsentry/sentry"]["prNumber"] == 100
        assert pr_states["getsentry/relay"]["prNumber"] == 200

    def test_get_cross_org_project_returns_403(self) -> None:
        """A project_id from a different org is rejected by get_projects()"""
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        response = self.client.get(self.url + f"?project={other_project.id}")

        assert response.status_code == 403


class TestOrganizationSeerExplorerPRGroupsEndpointAuth(APITestCase):
    endpoint = "sentry-api-0-organization-seer-explorer-pr-groups"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = reverse(self.endpoint, args=[self.organization.slug])

    def test_unauthenticated_user_gets_401(self) -> None:
        response = self.client.get(self.url + f"?project={self.project.id}")
        assert response.status_code == 401

    def test_user_without_org_access_gets_403(self) -> None:
        other_user = self.create_user()
        self.login_as(user=other_user)

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 403


@with_feature("organizations:seer-explorer")
class TestOrganizationSeerExplorerPRGroupsPermissionErrors(APITestCase):
    endpoint = "sentry-api-0-organization-seer-explorer-pr-groups"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = reverse(self.endpoint, args=[self.organization.slug])
        self.login_as(user=self.user)

    def test_seer_permission_error_returns_403(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_pr_groups.SeerExplorerClient",
            side_effect=SeerPermissionError("Feature flag not enabled"),
        ):
            response = self.client.get(self.url + f"?project={self.project.id}")
            assert response.status_code == 403
            assert response.data == {"detail": "Feature flag not enabled"}
