from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import APITestCase


class ProjectPreprodArtifactUserDownloadTest(APITestCase):
    endpoint = "sentry-api-0-project-preprod-artifact-user-download"

    def setUp(self) -> None:
        super().setUp()

        self.file = self.create_file(
            name="test_artifact.apk",
            type="application/octet-stream",
        )

        self.preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

    def test_download_preprod_artifact_success(self) -> None:
        self.login_as(self.user)

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.preprod_artifact.id,
        )

        assert response.status_code == 200
        assert response["Content-Type"] == "application/octet-stream"
        assert "attachment" in response["Content-Disposition"]
        assert f"preprod_artifact_{self.preprod_artifact.id}.zip" in response["Content-Disposition"]

    def test_download_preprod_artifact_unauthenticated(self) -> None:
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.preprod_artifact.id,
            status_code=403,
        )

    def test_download_preprod_artifact_not_found(self) -> None:
        self.login_as(self.user)

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            999999,
            status_code=404,
        )

        assert "not found" in response.data["error"]

    def test_download_preprod_artifact_no_file(self) -> None:
        no_file_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=None,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        self.login_as(self.user)

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            no_file_artifact.id,
            status_code=404,
        )

        assert "file not available" in response.data["error"]

    def test_download_preprod_artifact_no_project_access(self) -> None:
        other_user = self.create_user()
        self.login_as(other_user)

        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.preprod_artifact.id,
            status_code=403,
        )

    def test_download_preprod_artifact_different_project(self) -> None:
        other_project = self.create_project(organization=self.organization)
        other_artifact = PreprodArtifact.objects.create(
            project=other_project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        self.login_as(self.user)

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            other_artifact.id,
            status_code=404,
        )

        assert "not found" in response.data["error"]
