from datetime import timedelta
from typing import IO
from unittest.mock import patch

from django.core.files.base import ContentFile
from objectstore_client import TimeToLive

from sentry.constants import DataCategory
from sentry.models.files.file import File
from sentry.objectstore import UsecaseId, get_session
from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.preprod.objectstore import ObjectstoreFile
from sentry.runner.commands.migrate_preprod_to_objectstore import migrate_preprod_to_objectstore
from sentry.testutils.cases import CliTestCase
from sentry.testutils.skips import requires_objectstore


@requires_objectstore
class MigratePreprodTest(CliTestCase):
    command = migrate_preprod_to_objectstore

    def legacy_file(self, data: bytes) -> File:
        file = self.create_file(name="preprod-file", type="preprod.file")
        file.putfile(ContentFile(data))
        return file

    def test_resumes_and_moves_shared_analysis_once(self) -> None:
        before = self.create_preprod_artifact(
            project=self.project, file_id=self.legacy_file(b"before").id
        )
        head, head_metric, base, base_metric = self.create_preprod_artifact_pair_for_comparison()
        source = self.legacy_file(b"archive")
        installable = self.legacy_file(b"install")
        analysis = self.legacy_file(b"report")
        result = self.legacy_file(b"comparison")
        head.update(file_id=source.id, installable_app_file_id=installable.id)
        head_metric.update(analysis_file_id=analysis.id)
        watch = self.create_preprod_artifact_size_metrics(
            head,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            analysis_file_id=analysis.id,
        )
        comparison = self.create_preprod_artifact_size_comparison(
            head_size_analysis=head_metric, base_size_analysis=base_metric, file_id=result.id
        )
        args = ("--start-from", str(head.id))
        preview = self.invoke("--dry-run", *args)
        assert preview.exit_code == 0, preview.output
        assert "Eligible payloads: 4" in preview.output
        assert File.objects.filter(id=analysis.id).exists()

        with patch(
            "sentry.preprod.objectstore.quotas.backend.get_event_retention",
            side_effect=lambda *, organization, category: 30
            if category == DataCategory.SIZE_ANALYSIS
            else 90,
        ):
            migrated = self.invoke(*args, catch_exceptions=False)
        assert migrated.exit_code == 0
        assert "Migrated payloads: 4" in migrated.output
        assert f"START_FROM={head.id}" in migrated.output
        assert "Migrated payloads: 0" in self.invoke(*args).output
        assert File.objects.filter(id=before.file_id).exists()
        assert not File.objects.filter(
            id__in=[source.id, installable.id, analysis.id, result.id]
        ).exists()
        head.refresh_from_db()
        head_metric.refresh_from_db()
        watch.refresh_from_db()
        comparison.refresh_from_db()
        assert head_metric.analysis_storage_path == watch.analysis_storage_path
        for usecase, key, data, days in (
            (UsecaseId.PREPROD_ARTIFACTS, head.storage_path, b"archive", 90),
            (UsecaseId.PREPROD_DISTRIBUTION, head.installable_app_storage_path, b"install", 90),
            (UsecaseId.PREPROD_SIZE, head_metric.analysis_storage_path, b"report", 30),
            (UsecaseId.PREPROD_SIZE, comparison.storage_path, b"comparison", 30),
        ):
            assert key
            response = get_session(usecase, self.project).get(key)
            assert response is not None
            assert response.metadata.expiration_policy == TimeToLive(timedelta(days=days))
            with response.payload as stream:
                assert stream.read() == data

    def test_bad_source_is_preserved(self) -> None:
        source = self.legacy_file(b"original")
        artifact = self.create_preprod_artifact(project=self.project, file_id=source.id)
        source.update(checksum="0" * 40)
        assert self.invoke().exit_code != 0
        artifact.refresh_from_db()
        assert artifact.file_id == source.id
        assert artifact.storage_path is None
        assert File.objects.filter(pk=source.id).exists()

    def test_replacement_during_copy_wins(self) -> None:
        source = self.legacy_file(b"original")
        replacement = self.legacy_file(b"replacement")
        artifact = self.create_preprod_artifact(project=self.project, file_id=source.id)
        other = self.create_preprod_artifact(project=self.project, file_id=source.id)
        original_get = ObjectstoreFile.getfile

        def replace(stored: ObjectstoreFile) -> IO[bytes]:
            artifact.update(file_id=replacement.id)
            return original_get(stored)

        with patch.object(ObjectstoreFile, "getfile", replace):
            result = self.invoke(catch_exceptions=False)
        assert result.exit_code == 0
        artifact.refresh_from_db()
        other.refresh_from_db()
        assert artifact.file_id == replacement.id
        assert artifact.storage_path is None
        assert other.file_id is None
        assert other.storage_path
