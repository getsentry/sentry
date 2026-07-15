from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode


class TestOrganizationSeerRpcEndpoint(APITestCase):
    """Test the combined organization/project seer RPC endpoint"""

    endpoint = "sentry-api-0-organization-seer-rpc"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(self.user)

    def _get_path(self, method_name: str) -> str:
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "method_name": method_name,
            },
        )

    def test_no_feature_flag(self) -> None:
        """Test that requests without the feature flag return 404"""
        path = self._get_path("get_organization_slug")
        response = self.client.post(path, data={"args": {}}, format="json")
        assert response.status_code == 404

    @with_feature("organizations:seer-public-rpc")
    def test_unknown_method_returns_404(self) -> None:
        """Test that unknown method names return 404"""
        path = self._get_path("unknown_method")
        response = self.client.post(path, data={"args": {}}, format="json")
        assert response.status_code == 404

    @with_feature("organizations:seer-public-rpc")
    def test_org_level_method_get_organization_slug(self) -> None:
        """Test that organization-level methods work and return correct data"""
        path = self._get_path("get_organization_slug")
        response = self.client.post(path, data={"args": {}}, format="json")

        assert response.status_code == 200
        assert response.data == {"slug": self.organization.slug}

    @with_feature("organizations:seer-public-rpc")
    def test_get_organization_projects(self) -> None:
        """instrumentation reflects project flags via get_instrumentation"""
        path = self._get_path("get_organization_projects")

        # No flags set — instrumentation should be empty
        response = self.client.post(path, data={"args": {}}, format="json")
        assert response.status_code == 200
        project_data = next(p for p in response.data["projects"] if p["id"] == self.project.id)
        assert project_data["instrumentation"] == []

        # Set has_transactions and has_logs flags
        self.project.update(
            flags=Project.flags.has_transactions | Project.flags.has_logs,
        )

        response = self.client.post(path, data={"args": {}}, format="json")
        assert response.status_code == 200
        project_data = next(p for p in response.data["projects"] if p["id"] == self.project.id)
        assert set(project_data["instrumentation"]) == {"transactions", "spans", "logs"}

    @with_feature("organizations:seer-public-rpc")
    def test_org_level_method_get_organization_features(self) -> None:
        """Test that get_organization_features returns the features key"""
        path = self._get_path("get_organization_features")
        response = self.client.post(path, data={"args": {}}, format="json")

        assert response.status_code == 200
        assert "features" in response.data
        assert isinstance(response.data["features"], list)

    @with_feature("organizations:seer-public-rpc")
    def test_org_level_method_get_dsn(self) -> None:
        project = self.create_project(organization=self.organization, slug="wordcraft")
        path = self._get_path("get_dsn")

        response = self.client.post(
            path, data={"args": {"project_slug": "wordcraft"}}, format="json"
        )

        assert response.status_code == 200
        assert response.data is not None
        assert response.data["project_slug"] == "wordcraft"
        assert response.data["platform"] == project.platform
        assert response.data["dsn_public"].startswith("http")
        assert response.data["dsn_public"].endswith(f"/{project.id}")

    @with_feature("organizations:seer-public-rpc")
    def test_project_method_requires_project_id(self) -> None:
        """Test that project-level methods require project_id in args"""
        path = self._get_path("get_transactions_for_project")

        response = self.client.post(path, data={"args": {}}, format="json")

        assert response.status_code == 400  # ParseError

    @with_feature("organizations:seer-public-rpc")
    def test_project_method_validates_project_belongs_to_org(self) -> None:
        """Test that project_id must belong to the organization"""
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)

        path = self._get_path("get_transactions_for_project")
        response = self.client.post(
            path,
            data={"args": {"project_id": other_project.id}},
            format="json",
        )

        assert response.status_code == 404  # Project not found in this org

    @with_feature("organizations:seer-public-rpc")
    def test_project_method_validates_user_has_project_access(self) -> None:
        """Test that user must have access to the project"""
        # Create a project the user doesn't have access to
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_org)

        # Login as original user and try to access other user's project
        path = self._get_path("get_transactions_for_project")
        response = self.client.post(
            path,
            data={"args": {"project_id": other_project.id}},
            format="json",
        )

        # Should fail because project doesn't belong to our org
        assert response.status_code == 404

    @with_feature("organizations:seer-public-rpc")
    def test_project_method_with_nonexistent_project(self) -> None:
        """Test that non-existent project_id returns 404"""
        path = self._get_path("get_transactions_for_project")
        response = self.client.post(
            path,
            data={"args": {"project_id": 99999999}},
            format="json",
        )

        assert response.status_code == 404

    @with_feature("organizations:seer-public-rpc")
    def test_project_method_with_non_accessible_project(self) -> None:
        """Test that non-existent project_id returns 404"""
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        user = self.create_user()
        self.login_as(user)

        path = self._get_path("get_transactions_for_project")
        response = self.client.post(
            path,
            data={"args": {"project_id": self.project.id}},
            format="json",
        )

        assert response.status_code == 403  # Project not accessible

    @with_feature("organizations:seer-public-rpc")
    def test_unknown_method_returns_404_for_org_method(self) -> None:
        """Test that calling an unknown method in the org scope returns 404"""
        path = self._get_path("definitely_not_a_real_method")
        response = self.client.post(path, data={"args": {}}, format="json")
        assert response.status_code == 404

    @with_feature("organizations:seer-public-rpc")
    def test_org_read_permission(self) -> None:
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

        for scope in ["org:read", "org:write", "org:admin"]:
            with assume_test_silo_mode(SiloMode.CONTROL):
                token = ApiToken.objects.create(user=self.user, scope_list=[scope])

            path = self._get_path("get_organization_slug")
            response = self.client.post(
                path, data={"args": {}}, format="json", HTTP_AUTHORIZATION=f"Bearer {token.token}"
            )

            assert response.status_code == 200
            assert response.data == {"slug": self.organization.slug}

    @with_feature("organizations:seer-public-rpc")
    def test_org_level_method_duplicate_org_id(self) -> None:
        """Test that organization-level methods work and return correct data"""
        path = self._get_path("get_organization_slug")
        response = self.client.post(path, data={"args": {"org_id": 1}}, format="json")

        assert response.status_code == 200
        assert response.data == {"slug": self.organization.slug}

    @with_feature("organizations:seer-public-rpc")
    @patch("sentry.seer.agent.snapshot_indexes.make_agent_export_indexes_request")
    def test_export_agent_indexes(self, mock_request: MagicMock) -> None:
        """export_agent_indexes proxies to Seer and returns the result."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "org_id": self.organization.id,
            "version": 1,
            "tables": {"explorer_index": []},
        }
        mock_request.return_value = mock_response

        path = self._get_path("export_explorer_indexes")
        response = self.client.post(path, data={"args": {}}, format="json")

        assert response.status_code == 200
        assert response.data["org_id"] == self.organization.id
        assert "tables" in response.data
        # org_id injected from URL, not from caller-supplied args
        mock_request.assert_called_once_with(
            {"org_id": self.organization.id},
            viewer_context={"organization_id": self.organization.id},
        )

    @with_feature("organizations:seer-public-rpc")
    @patch("sentry.seer.agent.snapshot_indexes.make_agent_export_indexes_request")
    def test_export_agent_indexes_ignores_caller_supplied_org_id(
        self, mock_request: MagicMock
    ) -> None:
        """Caller cannot override org_id — it is always taken from the URL."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "org_id": self.organization.id,
            "version": 1,
            "tables": {},
        }
        mock_request.return_value = mock_response

        path = self._get_path("export_explorer_indexes")
        # Attempt to pass a different org_id in args
        response = self.client.post(path, data={"args": {"org_id": 99999}}, format="json")

        assert response.status_code == 200
        mock_request.assert_called_once_with(
            {"org_id": self.organization.id},
            viewer_context={"organization_id": self.organization.id},
        )

    @with_feature("organizations:seer-public-rpc")
    def test_get_issue_committers_with_project_access(self) -> None:
        """A member with access to the issue's project can read committers."""
        group = self.create_group(project=self.project)

        path = self._get_path("get_issue_committers")
        response = self.client.post(path, data={"args": {"issue_id": str(group.id)}}, format="json")

        assert response.status_code == 200
        assert response.data is not None
        assert response.data["project_id"] == self.project.id

    @with_feature("organizations:seer-public-rpc")
    def test_get_issue_committers_without_project_access_returns_null(self) -> None:
        """An org member without access to the issue's project gets a null result.

        Without the project-access gate, a closed-membership org member could supply
        any in-org issue_id and read commit/PR data for projects they cannot access.
        We collapse no-access into the same null "not found" signal so the caller can't
        tell the issue exists in a project they can't see.
        """
        group = self.create_group(project=self.project)

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        self.login_as(member)

        path = self._get_path("get_issue_committers")
        response = self.client.post(path, data={"args": {"issue_id": str(group.id)}}, format="json")

        assert response.status_code == 200
        assert response.data is None

    @with_feature("organizations:seer-public-rpc")
    def test_get_issue_committers_issue_in_other_org_returns_null(self) -> None:
        """An issue_id from a different org cannot be resolved and yields null."""
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)
        group = self.create_group(project=other_project)

        path = self._get_path("get_issue_committers")
        response = self.client.post(path, data={"args": {"issue_id": str(group.id)}}, format="json")

        assert response.status_code == 200
        assert response.data is None

    @with_feature("organizations:seer-public-rpc")
    def test_get_issue_details_with_project_access(self) -> None:
        """get_issue_details is project-access gated and works for a member with access."""
        group = self.create_group(project=self.project)

        path = self._get_path("get_issue_details")
        response = self.client.post(path, data={"args": {"issue_id": str(group.id)}}, format="json")

        assert response.status_code == 200
        assert response.data is not None
        assert response.data["project_id"] == self.project.id

    @with_feature("organizations:seer-public-rpc")
    def test_get_issue_details_without_project_access_returns_null(self) -> None:
        """get_issue_details collapses no-access into the null not-found signal."""
        group = self.create_group(project=self.project)

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        self.login_as(member)

        path = self._get_path("get_issue_details")
        response = self.client.post(path, data={"args": {"issue_id": str(group.id)}}, format="json")

        assert response.status_code == 200
        assert response.data is None

    @with_feature("organizations:seer-public-rpc")
    @patch("sentry.seer.endpoints.organization_seer_rpc.metrics.incr")
    def test_issue_scoped_authz_records_access_denied_outcome(self, mock_incr: MagicMock) -> None:
        group = self.create_group(project=self.project)

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        self.login_as(member)

        path = self._get_path("get_issue_committers")
        response = self.client.post(path, data={"args": {"issue_id": str(group.id)}}, format="json")

        assert response.status_code == 200
        assert response.data is None
        mock_incr.assert_any_call(
            "seer.org_rpc.issue_scoped_authz",
            tags={"method": "get_issue_committers", "outcome": "access_denied"},
        )

    @with_feature("organizations:seer-public-rpc")
    @patch("sentry.seer.endpoints.organization_seer_rpc.metrics.incr")
    def test_issue_scoped_authz_records_not_found_outcome(self, mock_incr: MagicMock) -> None:
        path = self._get_path("get_issue_committers")
        response = self.client.post(path, data={"args": {"issue_id": "123456789"}}, format="json")

        assert response.status_code == 200
        assert response.data is None
        mock_incr.assert_any_call(
            "seer.org_rpc.issue_scoped_authz",
            tags={"method": "get_issue_committers", "outcome": "not_found"},
        )

    @with_feature("organizations:seer-public-rpc")
    def test_has_repo_code_mappings(self) -> None:
        """Test that has_repo_code_mappings works through the public endpoint"""
        path = self._get_path("has_repo_code_mappings")
        response = self.client.post(
            path,
            data={
                "args": {
                    "provider": "integrations:github",
                    "external_id": "123",
                    "owner": "getsentry",
                    "name": "sentry",
                }
            },
            format="json",
        )

        assert response.status_code == 200
        assert response.data == {"has_code_mappings": False, "project_slug_to_id": {}}
