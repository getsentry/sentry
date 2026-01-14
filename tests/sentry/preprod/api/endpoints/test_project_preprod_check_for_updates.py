from django.urls import reverse

from sentry.models.orgauthtoken import OrgAuthToken
from sentry.preprod.models import PreprodArtifact
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


class ProjectPreprodCheckForUpdatesEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)

        # Create an integration token with project:distribution scope
        token_str = generate_token(self.org.slug, "")
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrgAuthToken.objects.create(
                organization_id=self.org.id,
                name="Test Integration Token",
                token_hashed=hash_token(token_str),
                scope_list=["project:distribution"],
            )
        self.api_token = token_str

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
        self.preprod_artifact = self.create_preprod_artifact(**defaults)
        self.mobile_app_info = self.create_preprod_artifact_mobile_app_info(
            preprod_artifact=self.preprod_artifact,
            build_version=defaults["build_version"],
            build_number=defaults["build_number"],
            app_name=defaults.get("app_name"),
            app_icon_id=defaults.get("app_icon_id"),
        )
        return self.preprod_artifact

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
        self.preprod_artifact = self.create_preprod_artifact(**defaults)
        self.mobile_app_info = self.create_preprod_artifact_mobile_app_info(
            preprod_artifact=self.preprod_artifact,
            build_version=defaults["build_version"],
            build_number=defaults["build_number"],
            app_name=defaults.get("app_name"),
            app_icon_id=defaults.get("app_icon_id"),
        )
        return self.preprod_artifact

    def test_missing_required_parameters(self):
        """Test that missing required parameters return 400"""
        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token}"
        )
        assert response.status_code == 400
        assert "Missing required parameters" in response.json()["error"]

    def test_current_artifact_not_found(self):
        """Test when main_binary_identifier is provided but artifact doesn't exist"""
        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=android&build_version=1.0.0&main_binary_identifier=nonexistent",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
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
            + "?app_id=com.example.app&platform=ios&build_version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
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
            + "?app_id=com.example.app&platform=android&build_version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
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
            + "?app_id=com.example.app&platform=ios&build_version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
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
            + "?app_id=com.example.app&platform=android&build_version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
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
            + "?app_id=com.example.app&platform=android&build_version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
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
            + "?app_id=com.example.app&platform=android&build_version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
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
            + "?app_id=com.example.app&platform=android&build_version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )

        assert response.status_code == 200
        data = response.json()

        assert data["current"] is not None
        assert data["update"] is None  # No update available

    def test_multiple_artifacts_same_version_different_build_configurations(self):
        """Test handling of multiple artifacts with same version but different build configurations"""

        debug_config = self.create_preprod_build_configuration(project=self.project, name="debug")
        release_config = self.create_preprod_build_configuration(
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
            + "?app_id=com.example.app&platform=android&build_version=1.0.0&main_binary_identifier=test-identifier&build_configuration=debug",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )

        assert response.status_code == 200
        data = response.json()

        # Should find the artifact with matching build configuration
        assert data["current"] is not None
        assert data["current"]["id"] == str(debug_artifact.id)

    def test_build_number_filtering(self):
        """Test that build_number parameter filters correctly"""
        # Create artifacts with same version but different build numbers
        self._create_android_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
        )

        self._create_android_artifact(
            main_binary_identifier="test-identifier-2",
            build_version="1.0.0",
            build_number=50,
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=android&build_version=1.0.0&build_number=42&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )

        assert response.status_code == 200
        data = response.json()

        # Should find the artifact with matching build number
        assert data["current"] is not None
        assert data["current"]["build_number"] == 42

    def test_invalid_build_number_format(self):
        """Test that invalid build_number format returns 400"""
        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=android&build_version=1.0.0&build_number=invalid&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )
        assert response.status_code == 400
        assert "Invalid build_number format" in response.json()["error"]

    def test_without_main_binary_identifier_with_build_number(self):
        """Test that main_binary_identifier is optional when build_number is provided"""
        self._create_android_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
        )

        url = self._get_url()
        response = self.client.get(
            url + "?app_id=com.example.app&platform=android&build_version=1.0.0&build_number=42",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["current"] is not None
        assert data["current"]["build_version"] == "1.0.0"

    def test_missing_both_main_binary_identifier_and_build_number(self):
        """Test that either main_binary_identifier or build_number must be provided"""
        url = self._get_url()
        response = self.client.get(
            url + "?app_id=com.example.app&platform=android&build_version=1.0.0",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )

        assert response.status_code == 400
        assert (
            "Either main_binary_identifier or build_number must be provided"
            in response.json()["error"]
        )

    def test_codesigning_type_filters_current_artifact(self):
        """Test that codesigning_type parameter filters the current artifact correctly"""
        # Create an iOS artifact with development codesigning
        self._create_ios_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
            extras={"codesigning_type": "development"},
        )

        # Create another artifact with app-store codesigning
        self._create_ios_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
            extras={"codesigning_type": "app-store"},
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=ios&build_version=1.0.0&main_binary_identifier=test-identifier&codesigning_type=development",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )

        assert response.status_code == 200
        data = response.json()

        # Should only find the development artifact
        assert data["current"] is not None
        assert data["current"]["build_version"] == "1.0.0"
        assert data["current"]["build_number"] == 42

    def test_codesigning_type_filters_updates(self):
        """Test that updates are filtered by the same codesigning_type as the current artifact"""
        # Create current iOS artifact with development codesigning
        self._create_ios_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
            extras={"codesigning_type": "development"},
        )

        # Create update with development codesigning (should be returned)
        self._create_ios_artifact(
            main_binary_identifier="different-identifier",
            build_version="1.1.0",
            build_number=50,
            extras={"codesigning_type": "development"},
        )

        # Create update with app-store codesigning (should NOT be returned)
        self._create_ios_artifact(
            main_binary_identifier="another-identifier",
            build_version="1.2.0",
            build_number=60,
            extras={"codesigning_type": "app-store"},
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=ios&build_version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )

        assert response.status_code == 200
        data = response.json()

        assert data["current"] is not None
        assert data["current"]["build_version"] == "1.0.0"

        # Should only return the development update (1.1.0), not app-store (1.2.0)
        assert data["update"] is not None
        assert data["update"]["build_version"] == "1.1.0"
        assert data["update"]["build_number"] == 50

    def test_codesigning_type_no_matching_update(self):
        """Test that no update is returned when codesigning_type doesn't match"""
        # Create current iOS artifact with development codesigning
        self._create_ios_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
            extras={"codesigning_type": "development"},
        )

        # Create update with app-store codesigning only
        self._create_ios_artifact(
            main_binary_identifier="different-identifier",
            build_version="1.1.0",
            build_number=50,
            extras={"codesigning_type": "app-store"},
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=ios&build_version=1.0.0&main_binary_identifier=test-identifier",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )

        assert response.status_code == 200
        data = response.json()

        assert data["current"] is not None
        assert data["current"]["build_version"] == "1.0.0"

        # Should not return update because codesigning_type doesn't match
        assert data["update"] is None

    def test_codesigning_type_with_build_configuration(self):
        """Test that codesigning_type works correctly with build configurations"""
        debug_config = self.create_preprod_build_configuration(project=self.project, name="debug")

        # Create current artifact with debug configuration and development codesigning
        self._create_ios_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
            build_configuration=debug_config,
            extras={"codesigning_type": "development"},
        )

        # Create update with same configuration and codesigning type
        self._create_ios_artifact(
            main_binary_identifier="different-identifier",
            build_version="1.1.0",
            build_number=50,
            build_configuration=debug_config,
            extras={"codesigning_type": "development"},
        )

        # Create update with same configuration but different codesigning type
        self._create_ios_artifact(
            main_binary_identifier="another-identifier",
            build_version="1.2.0",
            build_number=60,
            build_configuration=debug_config,
            extras={"codesigning_type": "app-store"},
        )

        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=ios&build_version=1.0.0&main_binary_identifier=test-identifier&build_configuration=debug",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )

        assert response.status_code == 200
        data = response.json()

        assert data["current"] is not None
        assert data["current"]["build_version"] == "1.0.0"

        # Should return 1.1.0 (matching codesigning_type), not 1.2.0
        assert data["update"] is not None
        assert data["update"]["build_version"] == "1.1.0"
        assert data["update"]["build_number"] == 50

    def test_codesigning_type_provided_explicitly(self):
        """Test that explicitly provided codesigning_type parameter is used for filtering"""
        # Create artifact with development codesigning
        self._create_ios_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
            extras={"codesigning_type": "development"},
        )

        # Create artifact with app-store codesigning
        self._create_ios_artifact(
            main_binary_identifier="test-identifier",
            build_version="1.0.0",
            build_number=42,
            extras={"codesigning_type": "app-store"},
        )

        # Request specifically for app-store
        url = self._get_url()
        response = self.client.get(
            url
            + "?app_id=com.example.app&platform=ios&build_version=1.0.0&main_binary_identifier=test-identifier&codesigning_type=app-store",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token}",
        )

        assert response.status_code == 200
        data = response.json()

        # Should find the app-store artifact
        assert data["current"] is not None
