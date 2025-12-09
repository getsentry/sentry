from django.urls import reverse

from sentry.models.apitoken import ApiToken
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
    def test_org_level_method_get_organization_project_ids(self) -> None:
        """Test that get_organization_project_ids returns projects for the org"""
        path = self._get_path("get_organization_project_ids")
        response = self.client.post(path, data={"args": {}}, format="json")

        assert response.status_code == 200
        assert "projects" in response.data
        # Should include our project
        project_ids = [p["id"] for p in response.data["projects"]]
        assert self.project.id in project_ids

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
