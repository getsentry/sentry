from django.test import override_settings

from sentry.models.files.file import File
from sentry.preprod.models import (
    InstallablePreprodArtifact,
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
)
from sentry.testutils.cases import APITestCase


class ProjectPreprodArtifactDeleteTest(APITestCase):
    endpoint = "sentry-api-0-project-preprod-artifact-delete"
    method = "delete"

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_delete_artifact_success(self):
        main_file = self.create_file(name="test_artifact.zip", type="application/zip")
        installable_file = self.create_file(name="test_app.ipa", type="application/octet-stream")
        artifact = self.create_preprod_artifact(
            file_id=main_file.id,
            installable_app_file_id=installable_file.id,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
        )
        analysis_file = self.create_file(name="analysis.json", type="application/json")
        size_metric = self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        )
        size_metric.analysis_file_id = analysis_file.id
        size_metric.save()
        installable = self.create_installable_preprod_artifact(
            preprod_artifact=artifact,
            url_path="test-url-path",
        )

        assert File.objects.filter(id=main_file.id).exists()
        assert File.objects.filter(id=installable_file.id).exists()
        assert File.objects.filter(id=analysis_file.id).exists()
        assert PreprodArtifact.objects.filter(id=artifact.id).exists()
        assert PreprodArtifactSizeMetrics.objects.filter(id=size_metric.id).exists()
        assert InstallablePreprodArtifact.objects.filter(id=installable.id).exists()

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            artifact.id,
            status_code=200,
        )

        assert response.data["success"] is True
        assert response.data["artifact_id"] == str(artifact.id)
        assert "message" in response.data
        assert response.data["files_deleted_count"] == 3  # main, installable, analysis files
        assert response.data["size_metrics_deleted"] == 1
        assert response.data["installable_artifacts_deleted"] == 1

        assert not File.objects.filter(id=main_file.id).exists()
        assert not File.objects.filter(id=installable_file.id).exists()
        assert not File.objects.filter(id=analysis_file.id).exists()
        assert not PreprodArtifact.objects.filter(id=artifact.id).exists()
        assert not PreprodArtifactSizeMetrics.objects.filter(id=size_metric.id).exists()
        assert not InstallablePreprodArtifact.objects.filter(id=installable.id).exists()

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_delete_artifact_not_found(self):
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            "999999",  # Non-existent artifact ID
            status_code=404,
        )

        assert "The requested head preprod artifact does not exist" in response.data["detail"]

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": False})
    def test_delete_artifact_feature_disabled(self):
        artifact = self.create_preprod_artifact(
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
        )
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            artifact.id,
            status_code=403,
        )

        assert response.data["error"] == "Feature not enabled"

    @override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
    def test_delete_artifact_minimal(self):
        """Test deleting an artifact with only the minimum required fields"""
        # Create the preprod artifact without optional files
        artifact = self.create_preprod_artifact(
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            artifact.id,
            status_code=200,
        )

        assert response.data["success"] is True
        assert response.data["artifact_id"] == str(artifact.id)
        assert response.data["files_deleted_count"] == 0  # No files to delete
        assert response.data["size_metrics_deleted"] == 0
        assert response.data["installable_artifacts_deleted"] == 0

        assert not PreprodArtifact.objects.filter(id=artifact.id).exists()
