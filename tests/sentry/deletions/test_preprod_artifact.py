from collections.abc import Mapping
from typing import Any

from sentry.deletions.defaults.preprod_artifact import PreprodArtifactDeletionTask
from sentry.models.files.file import File
from sentry.preprod.models import (
    InstallablePreprodArtifact,
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
)
from sentry.testutils.cases import TestCase


class PreprodArtifactDeletionTaskTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()

    def _delete_artifacts(self, query: Mapping[str, Any]) -> None:
        task = PreprodArtifactDeletionTask(
            manager=None,  # type: ignore[arg-type]
            model=PreprodArtifact,
            query=query,
        )
        has_more = task.chunk()
        assert has_more is False

    def test_delete_instance_bulk_with_all_files(self) -> None:
        main_file = self.create_file(name="artifact.zip", type="application/zip")
        installable_file = self.create_file(name="app.ipa", type="application/octet-stream")
        app_icon_file = self.create_file(name="icon.png", type="image/png")

        artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=main_file.id,
            installable_app_file_id=installable_file.id,
            app_icon_id=str(app_icon_file.id),
            app_name="test_app",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
        )

        analysis_file = self.create_file(name="analysis.json", type="application/json")
        size_metric = self.create_preprod_artifact_size_metrics(
            artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )
        size_metric.analysis_file_id = analysis_file.id
        size_metric.save()

        installable = self.create_installable_preprod_artifact(
            preprod_artifact=artifact,
            url_path="test-path",
        )

        self._delete_artifacts({"id": artifact.id})

        assert not PreprodArtifact.objects.filter(id=artifact.id).exists()
        assert not File.objects.filter(id=main_file.id).exists()
        assert not File.objects.filter(id=installable_file.id).exists()
        assert not File.objects.filter(id=app_icon_file.id).exists()
        assert not File.objects.filter(id=analysis_file.id).exists()
        assert not PreprodArtifactSizeMetrics.objects.filter(id=size_metric.id).exists()
        assert not InstallablePreprodArtifact.objects.filter(id=installable.id).exists()

    def test_delete_instance_bulk_multiple_artifacts(self) -> None:
        artifacts = []
        files = []

        for i in range(5):
            main_file = self.create_file(name=f"artifact_{i}.zip", type="application/zip")
            files.append(main_file)

            artifact = self.create_preprod_artifact(
                project=self.project,
                file_id=main_file.id,
                app_name=f"test_app_{i}",
                app_id=f"com.test.app{i}",
                build_version="1.0.0",
                build_number=i,
            )
            artifacts.append(artifact)

        artifact_ids = [a.id for a in artifacts]
        file_ids = [f.id for f in files]

        self._delete_artifacts({"id__in": artifact_ids})

        for artifact_id in artifact_ids:
            assert not PreprodArtifact.objects.filter(id=artifact_id).exists()
        for file_id in file_ids:
            assert not File.objects.filter(id=file_id).exists()

    def test_delete_instance_bulk_minimal_artifact(self) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="minimal_app",
            app_id="com.test.minimal",
            build_version="1.0.0",
            build_number=1,
        )

        self._delete_artifacts({"id": artifact.id})

        assert not PreprodArtifact.objects.filter(id=artifact.id).exists()
