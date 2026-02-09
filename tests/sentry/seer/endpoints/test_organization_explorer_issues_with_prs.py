from unittest.mock import MagicMock, patch

import requests
from django.urls import reverse

from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:seer-explorer")
class TestOrganizationExplorerIssuesWithPRsEndpoint(APITestCase):
    endpoint = "sentry-api-0-organization-explorer-issues-with-prs"

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
            "sentry.seer.endpoints.organization_explorer_issues_with_prs.SeerExplorerClient"
        )
        self.mock_client_class = self.client_patcher.start()
        self.mock_client = MagicMock()
        self.mock_client_class.return_value = self.mock_client

        self.serialize_patcher = patch(
            "sentry.seer.endpoints.organization_explorer_issues_with_prs.serialize"
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
        created_at="2025-01-15T00:00:00Z",
        repo_pr_states=None,
        title="test run",
    ):
        pr_states = repo_pr_states or {}
        prs = [
            {
                "pr_url": state.get("pr_url", ""),
                "pr_number": state.get("pr_number", 0),
                "repo_name": state.get("repo_name", repo_name),
            }
            for repo_name, state in pr_states.items()
            if state.get("pr_url") and state.get("pr_number") is not None
        ]
        return {
            "run_id": run_id,
            "group_id": group_id,
            "title": title,
            "prs": prs,
            "repo_pr_states": pr_states,
            "created_at": created_at,
            "last_triggered_at": created_at,
        }

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
        self.mock_client.get_issues_with_prs.return_value = [seer_item]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Test Issue"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(group.id)
        assert data[0]["explorerPrData"] == {
            "runId": 42,
            "createdAt": "2025-01-15T12:00:00Z",
            "repoPrStates": {
                "getsentry/sentry": {
                    "repoName": "getsentry/sentry",
                    "branchName": "fix/auth-bug",
                    "prNumber": 1234,
                    "prUrl": "https://github.com/getsentry/sentry/pull/1234",
                    "prCreationStatus": "created",
                }
            },
        }
        self.mock_client_class.assert_called_once()

    def test_get_empty_seer_response(self) -> None:
        self.mock_client.get_issues_with_prs.return_value = []

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        assert response.json() == []
        self.mock_serialize.assert_not_called()

    def test_get_none_seer_response(self) -> None:
        self.mock_client.get_issues_with_prs.return_value = None

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        assert response.json() == []

    def test_get_missing_project_param_returns_all_projects(self) -> None:
        """Without ?project=, get_projects() returns all accessible org projects."""
        group = self.create_group(project=self.project)
        self.mock_client.get_issues_with_prs.return_value = [
            self._make_seer_item(group_id=group.id)
        ]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Test"}]

        response = self.client.get(self.url)

        assert response.status_code == 200

    def test_get_non_integer_project_param(self) -> None:
        response = self.client.get(self.url + "?project=abc")

        assert response.status_code == 400
        assert "Invalid project parameter" in response.json()["detail"]

    def test_get_filters_by_project_id(self) -> None:
        """Groups not matching the requested project_id are excluded from the DB query."""
        group_in_project = self.create_group(project=self.project)
        other_project = self.create_project(organization=self.organization)
        group_in_other_project = self.create_group(project=other_project)

        self.mock_client.get_issues_with_prs.return_value = [
            self._make_seer_item(group_id=group_in_project.id, run_id=1),
            self._make_seer_item(group_id=group_in_other_project.id, run_id=2),
        ]
        self.mock_serialize.return_value = [{"id": str(group_in_project.id), "title": "In Project"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(group_in_project.id)

    def test_get_multiple_projects(self) -> None:
        """Passing multiple ?project= params returns groups from all requested projects."""
        project2 = self.create_project(organization=self.organization)
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=project2)

        self.mock_client.get_issues_with_prs.return_value = [
            self._make_seer_item(group_id=group1.id, run_id=1),
            self._make_seer_item(group_id=group2.id, run_id=2),
        ]
        self.mock_serialize.return_value = [
            {"id": str(group1.id), "title": "Issue 1"},
            {"id": str(group2.id), "title": "Issue 2"},
        ]

        response = self.client.get(self.url + f"?project={self.project.id}&project={project2.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        returned_ids = {d["id"] for d in data}
        assert returned_ids == {str(group1.id), str(group2.id)}

    def test_get_no_matching_groups_returns_empty(self) -> None:
        """When Seer returns group IDs that don't exist in the requested project, return empty."""
        self.mock_client.get_issues_with_prs.return_value = [self._make_seer_item(group_id=999999)]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        assert response.json() == []
        self.mock_serialize.assert_not_called()

    def test_get_filters_out_null_group_ids(self) -> None:
        """Runs without a group_id (non-autofix) are filtered out before querying groups."""
        group = self.create_group(project=self.project)

        self.mock_client.get_issues_with_prs.return_value = [
            self._make_seer_item(group_id=group.id, run_id=1),
            self._make_seer_item(group_id=None, run_id=2),
        ]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Issue 1"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(group.id)

    def test_get_all_null_group_ids_returns_empty(self) -> None:
        """When all runs have null group_id, return empty."""
        self.mock_client.get_issues_with_prs.return_value = [
            self._make_seer_item(group_id=None, run_id=1),
            self._make_seer_item(group_id=None, run_id=2),
        ]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        assert response.json() == []
        self.mock_serialize.assert_not_called()

    def test_get_seer_permission_error(self) -> None:
        self.mock_client_class.side_effect = SeerPermissionError("Feature flag not enabled")

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 403
        assert response.data == {"detail": "Feature flag not enabled"}

    def test_get_seer_api_http_error(self) -> None:
        """An HTTPError from the Seer API returns 502."""
        self.mock_client.get_issues_with_prs.side_effect = requests.HTTPError("Seer API Error")

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 502
        assert response.json() == {"detail": "Unexpected error calling Seer"}

    def test_get_multiple_groups_with_pr_data(self) -> None:
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)

        self.mock_client.get_issues_with_prs.return_value = [
            self._make_seer_item(group_id=group1.id, run_id=10),
            self._make_seer_item(group_id=group2.id, run_id=20),
        ]
        self.mock_serialize.return_value = [
            {"id": str(group1.id), "title": "Issue 1"},
            {"id": str(group2.id), "title": "Issue 2"},
        ]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["explorerPrData"]["runId"] == 10
        assert data[1]["explorerPrData"]["runId"] == 20

    def test_get_group_without_seer_data_has_no_pr_enrichment(self) -> None:
        """If serialize returns a group that isn't in seer_data_by_group_id, it should not have explorerPrData."""
        group = self.create_group(project=self.project)
        extra_group = self.create_group(project=self.project)

        self.mock_client.get_issues_with_prs.return_value = [
            self._make_seer_item(group_id=group.id, run_id=5),
        ]
        self.mock_serialize.return_value = [
            {"id": str(group.id), "title": "Issue 1"},
            {"id": str(extra_group.id), "title": "Issue 2"},
        ]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        data = response.json()
        assert "explorerPrData" in data[0]
        assert "explorerPrData" not in data[1]

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
        self.mock_client.get_issues_with_prs.return_value = [seer_item]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Test"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        pr_states = response.json()[0]["explorerPrData"]["repoPrStates"]
        assert pr_states["getsentry/sentry"]["repoName"] == "getsentry/sentry"
        assert pr_states["getsentry/sentry"]["branchName"] is None
        assert pr_states["getsentry/sentry"]["prNumber"] is None
        assert pr_states["getsentry/sentry"]["prUrl"] is None
        assert pr_states["getsentry/sentry"]["prCreationStatus"] is None

    def test_get_empty_repo_pr_states(self) -> None:
        group = self.create_group(project=self.project)
        seer_item = self._make_seer_item(group_id=group.id, repo_pr_states={})
        self.mock_client.get_issues_with_prs.return_value = [seer_item]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Test"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        assert response.json()[0]["explorerPrData"]["repoPrStates"] == {}

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
        self.mock_client.get_issues_with_prs.return_value = [seer_item]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Test"}]

        response = self.client.get(self.url + f"?project={self.project.id}")

        assert response.status_code == 200
        pr_states = response.json()[0]["explorerPrData"]["repoPrStates"]
        assert len(pr_states) == 2
        assert pr_states["getsentry/sentry"]["prNumber"] == 100
        assert pr_states["getsentry/relay"]["prNumber"] == 200

    def test_get_uses_group_serializer_snuba(self) -> None:
        from sentry.api.serializers.models.group import GroupSerializerSnuba

        group = self.create_group(project=self.project)
        self.mock_client.get_issues_with_prs.return_value = [
            self._make_seer_item(group_id=group.id)
        ]
        self.mock_serialize.return_value = [{"id": str(group.id), "title": "Test"}]

        self.client.get(self.url + f"?project={self.project.id}")

        serializer = self.mock_serialize.call_args[0][2]
        assert isinstance(serializer, GroupSerializerSnuba)
        assert serializer.organization_id == self.organization.id

    def test_get_cross_org_project_returns_403(self) -> None:
        """A project_id from a different org is rejected by get_projects()"""
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        response = self.client.get(self.url + f"?project={other_project.id}")

        assert response.status_code == 403


class TestOrganizationExplorerIssuesWithPRsEndpointAuth(APITestCase):
    endpoint = "sentry-api-0-organization-explorer-issues-with-prs"

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
class TestOrganizationExplorerIssuesWithPRsPermissionErrors(APITestCase):
    endpoint = "sentry-api-0-organization-explorer-issues-with-prs"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = reverse(self.endpoint, args=[self.organization.slug])
        self.login_as(user=self.user)

    def test_missing_gen_ai_features_flag(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_explorer_issues_with_prs.SeerExplorerClient",
            side_effect=SeerPermissionError("Feature flag not enabled"),
        ):
            response = self.client.get(self.url + f"?project={self.project.id}")
            assert response.status_code == 403
            assert response.data == {"detail": "Feature flag not enabled"}

    def test_missing_seer_acknowledgement(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_explorer_issues_with_prs.SeerExplorerClient",
            side_effect=SeerPermissionError("Seer has not been acknowledged by the organization."),
        ):
            response = self.client.get(self.url + f"?project={self.project.id}")
            assert response.status_code == 403
            assert response.data == {
                "detail": "Seer has not been acknowledged by the organization."
            }

    def test_missing_allow_joinleave_org_flag(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_explorer_issues_with_prs.SeerExplorerClient",
            side_effect=SeerPermissionError(
                "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely."
            ),
        ):
            response = self.client.get(self.url + f"?project={self.project.id}")
            assert response.status_code == 403
            assert response.data == {
                "detail": "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely."
            }
