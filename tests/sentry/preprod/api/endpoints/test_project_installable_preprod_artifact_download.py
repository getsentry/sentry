from datetime import timedelta

from django.utils import timezone

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import TestCase


class ProjectInstallablePreprodArtifactDownloadEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.file = self.create_file(
            name="test_installable.ipa",
            type="application/octet-stream",
        )

        self.preprod_artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            installable_app_file_id=self.file.id,
            build_version="1.2.3",
            app_id="com.example.TestApp",
            app_name="TestApp",
        )

        self.installable = self.create_installable_preprod_artifact(
            preprod_artifact=self.preprod_artifact,
            url_path="test-url-path-123",
            expiration_date=timezone.now() + timedelta(hours=24),
            download_count=0,
        )

    def _get_url(self, organization_id_or_slug=None, project_id_or_slug=None, url_path=None):
        org = organization_id_or_slug or self.organization.slug
        proj = project_id_or_slug or self.project.slug
        path = url_path or self.installable.url_path
        return f"/api/0/projects/{org}/{proj}/files/installablepreprodartifact/{path}/"

    def test_download_ipa_success(self) -> None:
        url = self._get_url() + "?response_format=ipa"
        response = self.client.get(url)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/octet-stream"
        assert "attachment" in response["Content-Disposition"]
        assert 'filename="com.example.TestApp@1.2.3.ipa"' in response["Content-Disposition"]
        assert response["Content-Length"] == str(self.file.size)

        # Verify download count was incremented
        self.installable.refresh_from_db()
        assert self.installable.download_count == 1

    def test_download_plist_success(self) -> None:
        url = self._get_url() + "?response_format=plist"
        response = self.client.get(url)

        assert response.status_code == 200
        assert response["Content-Type"] == "text/plain; charset=utf-8"

        plist_content = response.content.decode("utf-8")
        assert '<?xml version="1.0" encoding="UTF-8"?>' in plist_content

        # Verify the IPA URL is correctly constructed
        expected_url = f"http://testserver/api/0/projects/{self.organization.slug}/{self.project.slug}/files/installablepreprodartifact/{self.installable.url_path}/?response_format=ipa"
        assert expected_url in plist_content

        # Verify metadata is included
        assert "com.example.TestApp" in plist_content
        assert "TestApp" in plist_content

        initial_count = self.installable.download_count or 0
        self.installable.refresh_from_db()
        assert self.installable.download_count == initial_count

    def test_installable_not_found(self) -> None:
        url = self._get_url(url_path="nonexistent-path")
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.json()["error"] == "Installable preprod artifact not found"

    def test_installable_expired(self) -> None:
        self.installable.expiration_date = timezone.now() - timedelta(hours=1)
        self.installable.save()

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 410
        assert response.json()["error"] == "Install link expired"

    def test_no_installable_file(self) -> None:
        self.preprod_artifact.installable_app_file_id = None
        self.preprod_artifact.save()

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.json()["error"] == "No installable file available"
