from sentry.constants import ObjectStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class PreprodArtifactEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.artifact = self.create_preprod_artifact(project=self.project)

    def _get_url(self, org_slug, artifact_id):
        return f"/api/0/organizations/{org_slug}/preprodartifacts/{artifact_id}/build-details/"

    @with_feature("organizations:preprod-frontend-routes")
    def test_extracts_project_from_artifact(self):
        url = self._get_url(self.organization.slug, self.artifact.id)
        response = self.client.get(url)
        assert response.status_code == 200

    def test_artifact_not_found_returns_404(self):
        url = self._get_url(self.organization.slug, 999999)
        response = self.client.get(url)
        assert response.status_code == 404

    def test_artifact_from_different_org_returns_404(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_artifact = self.create_preprod_artifact(project=other_project)

        url = self._get_url(self.organization.slug, other_artifact.id)
        response = self.client.get(url)
        assert response.status_code == 404

    def test_user_without_project_access_returns_403(self):
        other_user = self.create_user()
        self.create_member(user=other_user, organization=self.organization)
        self.login_as(other_user)

        url = self._get_url(self.organization.slug, self.artifact.id)
        response = self.client.get(url)
        assert response.status_code == 403

    def test_artifact_from_inactive_project_returns_404(self):
        self.project.status = ObjectStatus.PENDING_DELETION
        self.project.save()

        url = self._get_url(self.organization.slug, self.artifact.id)
        response = self.client.get(url)
        assert response.status_code == 404


class PreprodArtifactEndpointProjectSlugValidationTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.artifact = self.create_preprod_artifact(project=self.project)

    def _get_url(self, org_slug, project_slug, artifact_id):
        return f"/api/0/projects/{org_slug}/{project_slug}/preprodartifacts/{artifact_id}/build-details/"

    @with_feature("organizations:preprod-frontend-routes")
    def test_project_slug_validation_matches(self):
        url = self._get_url(self.organization.slug, self.project.slug, self.artifact.id)
        response = self.client.get(url)
        assert response.status_code == 200

    def test_project_slug_validation_mismatch_returns_404(self):
        other_project = self.create_project(organization=self.organization)

        url = self._get_url(self.organization.slug, other_project.slug, self.artifact.id)
        response = self.client.get(url)
        assert response.status_code == 404
