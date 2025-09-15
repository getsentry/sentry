from django.urls import reverse

from sentry.preprod.models import PreprodArtifact, PreprodBuildConfiguration
from sentry.testutils.cases import APITestCase


class ProjectPreprodCheckForUpdatesEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.user = self.create_user(email="test@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.api_token = self.create_user_auth_token(
            user=self.user, scope_list=["org:admin", "project:admin"]
        )

        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")

        # Enable the feature flag for all tests by default
        self.feature_context = self.feature({"organizations:preprod-frontend-routes": True})
        self.feature_context.__enter__()

    def tearDown(self) -> None:
        # Exit the feature flag context manager
        self.feature_context.__exit__(None, None, None)
        super().tearDown()

    def _get_url(self):
        return reverse(
            "sentry-api-0-project-preprod-check-for-updates",
            args=[self.org.slug, self.project.slug],
        )

    def _create_android_artifact(self, **kwargs):
        """Helper to create an Android artifact with default values"""
        defaults = {
            "project": self.project,
            "file_id": self.file.id,
            "state": PreprodArtifact.ArtifactState.PROCESSED,
            "artifact_type": PreprodArtifact.ArtifactType.APK,
            "app_id": "com.example.app",
            "app_name": "TestApp",
            "build_version": "1.0.0",
            "build_number": 42,
            "build_configuration": None,
            "installable_app_file_id": self.file.id,
            "main_binary_identifier": "test-identifier-123",
        }
        defaults.update(kwargs)
        return PreprodArtifact.objects.create(**defaults)

    def _create_ios_artifact(self, **kwargs):
        """Helper to create an iOS artifact with default values"""
        defaults = {
            "project": self.project,
            "file_id": self.file.id,
            "state": PreprodArtifact.ArtifactState.PROCESSED,
            "artifact_type": PreprodArtifact.ArtifactType.XCARCHIVE,
            "app_id": "com.example.app",
            "app_name": "TestApp",
            "build_version": "1.0.0",
            "build_number": 42,
            "build_configuration": None,
            "installable_app_file_id": self.file.id,
            "main_binary_identifier": "test-identifier-123",
        }
        defaults.update(kwargs)
        return PreprodArtifact.objects.create(**defaults)

    def test_missing_required_parameters(self):
        """Test that missing required parameters return 400"""
        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 400
        assert "Missing required parameters" in response.json()["error"]

    def test_current_artifact_not_found(self):
        """Test when main_binary_identifier is provided but artifact doesn't exist"""
        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=android&version=1.0.0&main_binary_identifier=nonexistent",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        assert response.json()["current"] is None

    def test_current_artifact_success_ios(self):
        """Test successful current artifact retrieval for iOS"""
        self._create_ios_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=ios&version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        data = response.json()

        assert data["current"] is not None
        assert data["current"]["build_version"] == "1.0.0"
        assert data["current"]["build_number"] == 42
        assert data["current"]["app_name"] == "TestApp"
        assert data["current"]["download_url"] != ""
        assert "created_date" in data["current"]

    def test_update_detection_android(self):
        """Test update detection for Android with higher version"""
        # Create current artifact
        self._create_android_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
        )

        # Create higher version artifact
        self._create_android_artifact(
            main_binary_identifier="different-identifier",
            build_version="1.1.0",
            build_number=1,
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=android&version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        data = response.json()

        assert data["current"] is not None
        assert data["current"]["build_version"] == "1.0.0"

        assert data["update"] is not None
        assert data["update"]["build_version"] == "1.1.0"
        assert data["update"]["build_number"] == 1
        assert data["update"]["app_name"] == "TestApp"
        assert data["update"]["download_url"] != ""
        assert "created_date" in data["update"]

    def test_update_detection_ios(self):
        """Test update detection for iOS with higher version"""
        # Create current artifact
        self._create_ios_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
        )

        # Create higher version artifact
        self._create_ios_artifact(
            main_binary_identifier="different-identifier",
            build_version="1.1.0",
            build_number=1,
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=ios&version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        data = response.json()

        assert data["current"] is not None
        assert data["current"]["build_version"] == "1.0.0"

        assert data["update"] is not None
        assert data["update"]["build_version"] == "1.1.0"
        assert data["update"]["build_number"] == 1

    def test_platform_specific_filtering_android(self):
        """Test that Android platform only returns AAB/APK artifacts"""
        # Create Android artifact
        self._create_android_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
        )

        # Create iOS artifact with same app_id
        self._create_ios_artifact(
            main_binary_identifier="ios-identifier",
            build_version="1.1.0",
            build_number=50,
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=android&version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        data = response.json()

        # Should only find Android artifacts, not iOS
        assert data["update"] is None
        assert data["current"] is not None
        assert (
            data["current"]["build_version"] == "1.0.0"
        )  # Should find the Android artifact, not iOS

    def test_installable_artifact_filtering(self):
        """Test that only installable artifacts are considered for updates"""
        # Create non-installable artifact (no installable_app_file_id)
        self._create_android_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
            installable_app_file_id=None,
        )

        # Create installable artifact with higher version
        self._create_android_artifact(
            main_binary_identifier="different-identifier",
            build_version="1.1.0",
            build_number=50,
            installable_app_file_id=self.file.id,
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=android&version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        data = response.json()

        # Should find the installable artifact, not the non-installable one
        assert data["update"] is not None
        assert data["update"]["build_version"] == "1.1.0"

    def test_highest_build_number_selection(self):
        """Test that the artifact with highest build_number is selected when versions are equal"""
        # Create multiple artifacts with same version but different build numbers
        self._create_android_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
        )

        # Lower build number
        self._create_android_artifact(
            main_binary_identifier="different-identifier-1",
            build_version="1.1.0",
            build_number=40,
        )

        # Higher build number (should be selected)
        self._create_android_artifact(
            main_binary_identifier="different-identifier-2",
            build_version="1.1.0",
            build_number=60,
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=android&version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        data = response.json()

        # Should select the artifact with highest build_number
        assert data["update"] is not None
        assert data["update"]["build_version"] == "1.1.0"
        assert data["update"]["build_number"] == 60

    def test_no_update_available(self):
        """Test when no higher version is available"""
        # Create only current artifact
        self._create_android_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=android&version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        data = response.json()

        assert data["current"] is not None
        assert data["update"] is None  # No update available

    def test_multiple_artifacts_same_version_different_build_configurations(self):
        """Test handling of multiple artifacts with same version but different build configurations"""

        debug_config, _ = PreprodBuildConfiguration.objects.get_or_create(
            project=self.project, name="debug"
        )
        release_config, _ = PreprodBuildConfiguration.objects.get_or_create(
            project=self.project, name="release"
        )

        # Create artifacts with same version but different build configurations
        debug_artifact = self._create_android_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
            build_configuration=debug_config,
        )

        self._create_android_artifact(
            main_binary_identifier="different-identifier",
            build_version="1.0.0",
            build_number=50,
            build_configuration=release_config,
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=android&version=1.0.0&main_binary_identifier=test-identifier&build_configuration=debug",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        data = response.json()

        # Should find the artifact with matching build configuration
        assert data["current"] is not None
        assert data["current"]["id"] == str(debug_artifact.id)
