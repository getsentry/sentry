from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import APITestCase


class ProjectPreprodArtifactDownloadEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        # Create a test file
        self.file = self.create_file(
            name="test_artifact.apk",
            type="application/octet-stream",
        )

        # Create a preprod artifact
        self.preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

    def test_download_preprod_artifact_success(self):
        url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{self.preprod_artifact.id}/"

        with self.feature("organizations:preprod-artifact-assemble"):
            response = self.client.get(url)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/octet-stream"
        assert "attachment" in response["Content-Disposition"]

    def test_download_preprod_artifact_not_found(self):
        url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/999999/"

        with self.feature("organizations:preprod-artifact-assemble"):
            response = self.client.get(url)

        assert response.status_code == 404
        assert "not found" in response.data["error"]

    def test_download_preprod_artifact_not_processed(self):
        # Create an artifact that's not processed yet
        unprocessed_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.UPLOADING,
        )

        url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{unprocessed_artifact.id}/"

        with self.feature("organizations:preprod-artifact-assemble"):
            response = self.client.get(url)

        assert response.status_code == 400
        assert "not ready for download" in response.data["error"]

    def test_download_preprod_artifact_no_file(self):
        # Create an artifact without a file
        no_file_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=None,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{no_file_artifact.id}/"

        with self.feature("organizations:preprod-artifact-assemble"):
            response = self.client.get(url)

        assert response.status_code == 404
        assert "file not available" in response.data["error"]
