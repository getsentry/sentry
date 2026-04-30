from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class DsnLookupEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-dsn-lookup"

    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.key = self.project.key_set.first()
        assert self.key is not None
        self.dsn = self.key.dsn_public
        self.login_as(self.user)

    def test_valid_dsn_returns_project_info(self) -> None:
        response = self.get_success_response(self.org.slug, qs_params={"dsn": self.dsn})
        assert response.data["organizationSlug"] == self.org.slug
        assert response.data["projectSlug"] == self.project.slug
        assert response.data["projectId"] == str(self.project.id)
        assert response.data["projectName"] == self.project.name

    def test_missing_dsn_param_returns_400(self) -> None:
        response = self.get_response(self.org.slug, qs_params={})
        assert response.status_code == 400

    def test_invalid_dsn_format_returns_404(self) -> None:
        response = self.get_response(self.org.slug, qs_params={"dsn": "not-a-dsn"})
        assert response.status_code == 404

    def test_dsn_from_other_org_returns_404(self) -> None:
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_org)
        other_key = other_project.key_set.first()
        assert other_key is not None

        response = self.get_response(self.org.slug, qs_params={"dsn": other_key.dsn_public})
        assert response.status_code == 404

    def test_user_without_project_access_returns_404(self) -> None:
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(organization=org, teams=[team])
        key = project.key_set.first()
        assert key is not None

        user_without_access = self.create_user()
        self.create_member(user=user_without_access, organization=org, role="member", teams=[])
        self.login_as(user_without_access)

        response = self.get_response(org.slug, qs_params={"dsn": key.dsn_public})
        assert response.status_code == 404
