from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DsnLookupEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-dsn-lookup"

    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.key = self.project.key_set.first()
        assert self.key is not None
        self.dsn = self.key.dsn_public
        self.login_as(self.user)

    def test_valid_dsn_returns_project_info(self):
        with self.feature("organizations:cmd-k-dsn-lookup"):
            response = self.get_success_response(self.org.slug, qs_params={"dsn": self.dsn})
        assert response.data["organizationSlug"] == self.org.slug
        assert response.data["projectSlug"] == self.project.slug
        assert response.data["projectId"] == str(self.project.id)
        assert response.data["projectName"] == self.project.name

    def test_missing_dsn_param_returns_400(self):
        with self.feature("organizations:cmd-k-dsn-lookup"):
            response = self.get_response(self.org.slug, qs_params={})
        assert response.status_code == 400

    def test_invalid_dsn_format_returns_404(self):
        with self.feature("organizations:cmd-k-dsn-lookup"):
            response = self.get_response(self.org.slug, qs_params={"dsn": "not-a-dsn"})
        assert response.status_code == 404

    def test_dsn_from_other_org_returns_404(self):
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_org)
        other_key = other_project.key_set.first()
        assert other_key is not None

        with self.feature("organizations:cmd-k-dsn-lookup"):
            response = self.get_response(self.org.slug, qs_params={"dsn": other_key.dsn_public})
        assert response.status_code == 404

    def test_feature_flag_disabled_returns_404(self):
        response = self.get_response(self.org.slug, qs_params={"dsn": self.dsn})
        assert response.status_code == 404
