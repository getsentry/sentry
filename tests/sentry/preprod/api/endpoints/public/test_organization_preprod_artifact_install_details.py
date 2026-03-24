from django.urls import reverse

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import APITestCase


class OrganizationPreprodArtifactPublicInstallDetailsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-preprod-artifact-public-install-details"

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")
        self.installable_file = self.create_file(
            name="installable.apk", type="application/octet-stream"
        )

        self.preprod_artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=42,
        )

    def _get_url(self, artifact_id=None):
        artifact_id = artifact_id or self.preprod_artifact.id
        return reverse(
            self.endpoint,
            args=[self.organization.slug, artifact_id],
        )

    def test_artifact_not_found(self):
        response = self.client.get(self._get_url(artifact_id=999999))
        assert response.status_code == 404
        assert "The requested preprod artifact does not exist" in response.json()["detail"]

    def test_cross_org_artifact_access(self):
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)
        other_file = self.create_file(name="other.apk", type="application/octet-stream")
        other_artifact = self.create_preprod_artifact(
            project=other_project,
            file_id=other_file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.other.app",
        )

        response = self.client.get(self._get_url(artifact_id=other_artifact.id))
        assert response.status_code == 404

    def test_not_installable_artifact(self):
        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        assert data["buildId"] == str(self.preprod_artifact.id)
        assert data["state"] == "PROCESSED"
        assert data["platform"] == "ANDROID"
        assert data["projectId"] == str(self.project.id)
        assert data["projectSlug"] == self.project.slug
        assert data["buildConfiguration"] is None
        assert data["isInstallable"] is False
        assert data["installUrl"] is None
        assert data["downloadCount"] == 0

        app_info = data["appInfo"]
        assert app_info["appId"] == "com.example.app"
        assert app_info["version"] == "1.0.0"
        assert app_info["buildNumber"] == 42
        assert app_info["artifactType"] == "APK"

        assert data["gitInfo"] is None

        # iOS fields should be None for android
        assert data["isCodeSignatureValid"] is None
        assert data["profileName"] is None
        assert data["codesigningType"] is None

    def test_installable_android_artifact(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            installable_app_file_id=self.installable_file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=42,
            extras={"release_notes": "Bug fixes and improvements"},
        )

        response = self.client.get(self._get_url(artifact_id=artifact.id))
        assert response.status_code == 200
        data = response.json()
        assert data["isInstallable"] is True
        assert data["installUrl"] is not None
        assert data["platform"] == "ANDROID"
        assert data["releaseNotes"] == "Bug fixes and improvements"
        assert data["isCodeSignatureValid"] is None

    def test_installable_ios_artifact_valid_signature(self):
        ios_file = self.create_file(name="test.xcarchive", type="application/octet-stream")
        installable_file = self.create_file(name="test.ipa", type="application/octet-stream")
        artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=ios_file.id,
            installable_app_file_id=installable_file.id,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.iosapp",
            build_version="1.0.0",
            build_number=1,
            extras={
                "is_code_signature_valid": True,
                "profile_name": "iOS Team Provisioning Profile",
                "codesigning_type": "development",
            },
        )

        response = self.client.get(self._get_url(artifact_id=artifact.id))
        assert response.status_code == 200
        data = response.json()
        assert data["isInstallable"] is True
        assert data["installUrl"] is not None
        assert data["platform"] == "APPLE"
        assert data["isCodeSignatureValid"] is True
        assert data["profileName"] == "iOS Team Provisioning Profile"
        assert data["codesigningType"] == "development"

    def test_ios_artifact_invalid_signature(self):
        ios_file = self.create_file(name="test.xcarchive", type="application/octet-stream")
        installable_file = self.create_file(name="test.ipa", type="application/octet-stream")
        artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=ios_file.id,
            installable_app_file_id=installable_file.id,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.iosapp",
            build_version="1.0.0",
            build_number=1,
            extras={"is_code_signature_valid": False},
        )

        response = self.client.get(self._get_url(artifact_id=artifact.id))
        assert response.status_code == 200
        data = response.json()
        assert data["isInstallable"] is False
        assert data["installUrl"] is None
        assert data["isCodeSignatureValid"] is False
