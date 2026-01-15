from django.urls import reverse

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import APITestCase


class OrganizationPreprodArtifactBuildDetailsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.user = self.create_user(email="test@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.api_token = self.create_user_auth_token(
            user=self.user, scope_list=["org:admin", "project:admin"]
        )

        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")

        commit_comparison = self.create_commit_comparison(
            organization=self.org,
            head_sha="1234567890098765432112345678900987654321",
            base_sha="9876543210012345678998765432100123456789",
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/xyz",
            base_ref="main",
            pr_number=123,
        )

        self.preprod_artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app",
            build_configuration=None,
            installable_app_file_id=1234,
            commit_comparison=commit_comparison,
        )
        self.mobile_app_info = self.create_preprod_artifact_mobile_app_info(
            preprod_artifact=self.preprod_artifact,
            build_version="1.0.0",
            build_number=42,
        )

        # Enable the feature flag for all tests by default
        self.feature_context = self.feature({"organizations:preprod-frontend-routes": True})
        self.feature_context.__enter__()

    def tearDown(self) -> None:
        self.feature_context.__exit__(None, None, None)
        super().tearDown()

    def _get_url(self, artifact_id=None):
        artifact_id = artifact_id or self.preprod_artifact.id
        return reverse(
            "sentry-api-0-organization-preprod-artifact-build-details",
            args=[self.org.slug, artifact_id],
        )

    def test_get_build_details_success(self) -> None:
        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["state"] == self.preprod_artifact.state
        assert resp_data["app_info"]["app_id"] == self.preprod_artifact.app_id
        assert resp_data["app_info"]["name"] == self.mobile_app_info.app_name
        assert resp_data["app_info"]["version"] == self.mobile_app_info.build_version
        assert resp_data["app_info"]["build_number"] == self.mobile_app_info.build_number
        assert resp_data["project_id"] == self.project.id
        assert resp_data["project_slug"] == self.project.slug

    def test_get_build_details_not_found(self) -> None:
        url = self._get_url(artifact_id=999999)
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 404
        assert "not found in organization" in response.json()["detail"]

    def test_get_build_details_wrong_organization(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_artifact = self.create_preprod_artifact(
            project=other_project,
            file_id=self.file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.other",
        )

        url = self._get_url(artifact_id=other_artifact.id)
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 404
        assert "not found in organization" in response.json()["detail"]

    def test_get_build_details_feature_flag_disabled(self) -> None:
        with self.feature({"organizations:preprod-frontend-routes": False}):
            url = self._get_url()
            response = self.client.get(
                url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
            )
            assert response.status_code == 403
            assert response.json()["detail"] == "Feature not enabled"

    def test_get_build_details_invalid_artifact_id(self) -> None:
        url = reverse(
            "sentry-api-0-organization-preprod-artifact-build-details",
            args=[self.org.slug, "not-a-number"],
        )
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 400
        assert "Invalid artifact ID" in response.json()["detail"]

    def test_get_build_details_failed_artifact(self) -> None:
        self.preprod_artifact.state = PreprodArtifact.ArtifactState.FAILED
        self.preprod_artifact.error_message = "Analysis failed"
        self.preprod_artifact.save()

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Analysis failed"

    def test_get_build_details_returns_project_info(self) -> None:
        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["project_id"] == self.project.id
        assert resp_data["project_slug"] == self.project.slug
