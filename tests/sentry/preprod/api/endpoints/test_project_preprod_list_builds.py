from django.urls import reverse

from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import APITestCase


class ProjectPreprodListBuildsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.user = self.create_user(email="test@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.api_token = self.create_user_auth_token(
            user=self.user, scope_list=["org:admin", "project:admin"]
        )

        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.org.id,
            head_sha="1234567890098765432112345678900987654321",
            base_sha="9876543210012345678998765432100123456789",
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/xyz",
            base_ref="main",
            pr_number=123,
        )

        # Create multiple artifacts for testing pagination
        self.artifact1 = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app",
            app_name="TestApp",
            build_version="1.0.0",
            build_number=42,
            build_configuration=None,
            installable_app_file_id=1234,
            commit_comparison=commit_comparison,
        )

        self.artifact2 = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            app_id="com.example.app2",
            app_name="TestApp2",
            build_version="2.0.0",
            build_number=43,
            build_configuration=None,
            installable_app_file_id=1235,
            commit_comparison=commit_comparison,
        )

        self.artifact3 = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app3",
            app_name="TestApp3",
            build_version="3.0.0",
            build_number=44,
            build_configuration=None,
            installable_app_file_id=1236,
            commit_comparison=commit_comparison,
        )

        # Enable the feature flag for all tests by default
        self.feature_context = self.feature({"organizations:preprod-frontend-routes": True})
        self.feature_context.__enter__()

    def tearDown(self) -> None:
        # Exit the feature flag context manager
        self.feature_context.__exit__(None, None, None)
        super().tearDown()

    def _get_url(self):
        return reverse(
            "sentry-api-0-project-preprod-list-builds",
            args=[self.org.slug, self.project.slug],
        )

    def test_list_builds_success(self) -> None:
        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert "builds" in resp_data
        assert "pagination" in resp_data
        assert len(resp_data["builds"]) == 3  # Should return all 3 artifacts

        # Check that builds are ordered by date_added (most recent first)
        assert resp_data["builds"][0]["app_info"]["app_id"] == "com.example.app3"
        assert resp_data["builds"][1]["app_info"]["app_id"] == "com.example.app2"
        assert resp_data["builds"][2]["app_info"]["app_id"] == "com.example.app"

    def test_list_builds_with_pagination(self) -> None:
        url = self._get_url()
        response = self.client.get(
            f"{url}?per_page=2&page=1",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert len(resp_data["builds"]) == 2
        assert resp_data["pagination"]["per_page"] == 2
        assert resp_data["pagination"]["page"] == 0
        assert resp_data["pagination"]["has_next"] is True
        assert resp_data["pagination"]["has_prev"] is False

        # Get second page
        response = self.client.get(
            f"{url}?per_page=2&page=2",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert len(resp_data["builds"]) == 1
        assert resp_data["pagination"]["has_next"] is False
        assert resp_data["pagination"]["has_prev"] is True

    def test_list_builds_with_filters(self) -> None:
        url = self._get_url()

        # Filter by app_id
        response = self.client.get(
            f"{url}?app_id=com.example.app2",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert len(resp_data["builds"]) == 1
        assert resp_data["builds"][0]["app_info"]["app_id"] == "com.example.app2"

        # Filter by platform
        response = self.client.get(
            f"{url}?platform=android",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert len(resp_data["builds"]) == 2  # APK and AAB are both Android
        for result in resp_data["builds"]:
            assert result["app_info"]["platform"] in ["android"]

        # Filter by state
        response = self.client.get(
            f"{url}?state=3",  # PROCESSED state
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert len(resp_data["builds"]) == 2  # Only 2 artifacts are PROCESSED

    def test_list_builds_feature_flag_disabled(self) -> None:
        with self.feature({"organizations:preprod-frontend-routes": False}):
            url = self._get_url()
            response = self.client.get(
                url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
            )
            assert response.status_code == 403
            assert response.json()["error"] == "Feature not enabled"

    def test_list_builds_invalid_pagination_params(self) -> None:
        url = self._get_url()

        # Test invalid per_page (should be capped at 100)
        response = self.client.get(
            f"{url}?per_page=200",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["pagination"]["per_page"] == 100

        # Test invalid page (should default to 1)
        response = self.client.get(
            f"{url}?page=0",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["pagination"]["page"] == 0

    def test_list_builds_empty_builds(self) -> None:
        # Create a different project with no artifacts
        other_project = self.create_project(organization=self.org)
        url = reverse(
            "sentry-api-0-project-preprod-list-builds",
            args=[self.org.slug, other_project.slug],
        )

        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert len(resp_data["builds"]) == 0
        assert resp_data["pagination"]["has_next"] is False
        assert resp_data["pagination"]["has_prev"] is False
