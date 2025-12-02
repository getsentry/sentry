from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.preprod.analytics import PreprodArtifactApiInstallDetailsEvent
from sentry.preprod.models import InstallablePreprodArtifact
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_any_analytics_event


class ProjectPreprodInstallDetailsEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.file = self.create_file(
            name="test_installable.ipa",
            type="application/octet-stream",
        )
        self.login_as(user=self.user)

    def _get_url(self, artifact_id=None):
        artifact_id = artifact_id or self.preprod_artifact.id
        return f"/api/0/projects/{self.organization.slug}/{self.project.slug}/preprodartifacts/{artifact_id}/install-details/"

    def _create_ios_artifact(self, **kwargs):
        """Helper to create an iOS artifact with default valid extras"""
        from sentry.preprod.models import PreprodArtifact

        defaults = {
            "project": self.project,
            "file_id": self.file.id,
            "state": PreprodArtifact.ArtifactState.PROCESSED,
            "artifact_type": PreprodArtifact.ArtifactType.XCARCHIVE,
            "installable_app_file_id": self.file.id,
            "build_version": "1.2.3",
            "extras": {
                "is_code_signature_valid": True,
                "profile_name": "Test Profile",
                "codesigning_type": "development",
            },
        }
        defaults.update(kwargs)
        return self.create_preprod_artifact(**defaults)

    def _create_android_artifact(self, **kwargs):
        """Helper to create an Android artifact with default valid extras"""
        from sentry.preprod.models import PreprodArtifact

        defaults = {
            "project": self.project,
            "file_id": self.file.id,
            "state": PreprodArtifact.ArtifactState.PROCESSED,
            "artifact_type": PreprodArtifact.ArtifactType.AAB,
            "installable_app_file_id": self.file.id,
            "build_version": "1.2.3",
        }
        defaults.update(kwargs)
        return self.create_preprod_artifact(**defaults)

    @patch("sentry.analytics.record")
    def test_ios_artifact_success(self, mock_analytics: MagicMock) -> None:
        """Test successful iOS artifact install details request"""
        self.preprod_artifact = self._create_ios_artifact()

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert data["is_code_signature_valid"] is True
        assert data["profile_name"] == "Test Profile"
        assert data["codesigning_type"] == "development"
        assert "install_url" in data

        # Verify iOS-specific URL parameter
        assert "?response_format=plist" in data["install_url"]

        # Verify analytics was called
        assert_any_analytics_event(
            mock_analytics,
            PreprodArtifactApiInstallDetailsEvent(
                organization_id=self.project.organization_id,
                project_id=self.project.id,
                user_id=self.user.id,
                artifact_id=str(self.preprod_artifact.id),
            ),
        )

        # Verify InstallablePreprodArtifact was created
        installable = InstallablePreprodArtifact.objects.get(preprod_artifact=self.preprod_artifact)
        assert installable.download_count == 0
        assert installable.expiration_date is not None
        assert installable.expiration_date > timezone.now()

    @patch("sentry.analytics.record")
    def test_android_artifact_success(self, mock_analytics: MagicMock) -> None:
        """Test successful Android artifact install details request"""
        self.preprod_artifact = self._create_android_artifact()

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "install_url" in data

        # Verify Android-specific URL (no plist parameter)
        assert "?response_format=plist" not in data["install_url"]

        # Verify analytics was called
        assert_any_analytics_event(
            mock_analytics,
            PreprodArtifactApiInstallDetailsEvent(
                organization_id=self.project.organization_id,
                project_id=self.project.id,
                user_id=self.user.id,
                artifact_id=str(self.preprod_artifact.id),
            ),
        )

    def test_artifact_not_found(self) -> None:
        """Test when artifact doesn't exist"""
        url = self._get_url(artifact_id=99999)
        response = self.client.get(url)

        assert response.status_code == 404

    def test_invalid_code_signature(self) -> None:
        """Test when code signature is invalid"""
        self.preprod_artifact = self._create_ios_artifact(extras={"is_code_signature_valid": False})

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert data["is_code_signature_valid"] is False
        assert "install_url" not in data

    def test_missing_extras(self) -> None:
        """Test when extras field is missing"""
        self.preprod_artifact = self._create_ios_artifact(extras=None)

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert data["is_code_signature_valid"] is False
        assert "install_url" not in data

    def test_missing_code_signature_valid_field(self) -> None:
        """Test when is_code_signature_valid field is missing from extras"""
        self.preprod_artifact = self._create_ios_artifact(extras={"profile_name": "Test Profile"})

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert data["is_code_signature_valid"] is False
        assert "install_url" not in data

    def test_no_installable_file(self) -> None:
        """Test when installable_app_file_id is None"""
        self.preprod_artifact = self._create_ios_artifact(installable_app_file_id=None)

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 404
        data = response.json()
        assert data["error"] == "Installable file not available"

    def test_unauthorized_access(self) -> None:
        """Test that unauthorized users cannot access the endpoint"""
        self.preprod_artifact = self._create_ios_artifact()

        # Create a different user and log them in
        other_user = self.create_user()
        self.login_as(user=other_user)

        url = self._get_url()
        response = self.client.get(url)

        # Should be denied access since user doesn't have access to the project
        assert response.status_code == 403
