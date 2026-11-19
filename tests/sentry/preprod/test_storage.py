from hashlib import sha1
from typing import Any
from unittest.mock import patch
from urllib.parse import urlsplit

from django.core.files.base import ContentFile
from django.test import override_settings

from sentry.models.files.file import File
from sentry.models.files.fileblob import FileBlob
from sentry.objectstore import UsecaseId, get_session
from sentry.preprod.models import PreprodArtifactSizeComparison
from sentry.preprod.size_analysis.comparison_run import run_size_analysis_comparisons
from sentry.preprod.size_analysis.models import ComparisonResults
from sentry.preprod.objectstore import writes_to_objectstore
from sentry.preprod.tasks import (
    assemble_preprod_artifact,
    assemble_preprod_artifact_installable_app,
    assemble_preprod_artifact_size_analysis,
)
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.objectstore import preprod_test_both_backends
from tests.sentry.tasks.test_assemble import BaseAssembleTest


@preprod_test_both_backends
class PreprodStorageTest(BaseAssembleTest):
    def chunks(self, data: bytes) -> dict[str, Any]:
        blob = FileBlob.from_file_with_organization(ContentFile(data), self.organization)
        return dict(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=sha1(data).hexdigest(),
            chunks=[blob.checksum],
        )

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_build_downloads(self) -> None:
        artifact = self.create_preprod_artifact(project=self.project)
        payload = b"uploaded archive"
        with patch("sentry.preprod.tasks.dispatch_taskbroker"):
            assemble_preprod_artifact(artifact_id=artifact.id, **self.chunks(payload))
        assemble_preprod_artifact_installable_app(
            artifact_id=artifact.id, **self.chunks(b"installable")
        )
        artifact.refresh_from_db()
        objectstore = writes_to_objectstore(self.project)
        assert (artifact.file_id is None) == objectstore
        assert (artifact.storage_path is not None) == objectstore
        assert (artifact.installable_app_file_id is None) == objectstore
        assert (artifact.installable_app_storage_path is not None) == objectstore
        with artifact.get_installable_file().getfile() as fp:
            assert fp.read() == b"installable"
        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{artifact.id}/"
        signature = generate_service_request_signature(url, b"", ["test-secret-key"], "Launchpad")
        headers = {"HTTP_AUTHORIZATION": f"rpcsignature {signature}"}
        head = self.client.head(url, **headers)
        assert head.status_code == 200
        assert head["Content-Length"] == str(len(payload))
        if objectstore:
            assert not File.objects.filter(type__in=["preprod.file", "preprod.artifact"]).exists()
            response = get_session(UsecaseId.PREPROD_ARTIFACTS, self.project).get(
                artifact.storage_path
            )
            assert response is not None
            with response.payload as fp:
                assert fp.read() == payload
            with patch("sentry.auth.system.is_internal_ip", return_value=False):
                redirect = self.client.get(url, HTTP_RANGE="bytes=3-", **headers)
            assert redirect.status_code == 302
            location = urlsplit(redirect["Location"])
            ranged = self.client.get(f"{location.path}?{location.query}", HTTP_RANGE="bytes=3-")
            assert ranged.status_code == 206
            assert b"".join(ranged.streaming_content) == payload[3:]
        else:
            response = self.client.get(url, HTTP_RANGE="bytes=3-", **headers)
            assert response.status_code == 206
            assert response.content == payload[3:]

    def test_size_analysis_and_comparison(self) -> None:
        head, head_metric, base, base_metric = self.create_preprod_artifact_pair_for_comparison()
        payload = b'{"analysis_duration":1,"download_size":100,"install_size":200}'
        for artifact, metric in ((head, head_metric), (base, base_metric)):
            assemble_preprod_artifact_size_analysis(artifact_id=artifact.id, **self.chunks(payload))
            metric.refresh_from_db()
            assert (metric.analysis_file_id is None) == writes_to_objectstore(self.project)
            with metric.get_analysis_file().getfile() as fp:
                assert fp.read() == payload
        run_size_analysis_comparisons(
            self.organization.id, [{"head_metric": head_metric, "base_metric": base_metric}], []
        )
        comparison = PreprodArtifactSizeComparison.objects.get(
            head_size_analysis=head_metric, base_size_analysis=base_metric
        )
        objectstore = writes_to_objectstore(self.project)
        assert (comparison.file_id is None) == objectstore
        assert (comparison.storage_path is not None) == objectstore
        with comparison.get_result_file().getfile() as fp:
            ComparisonResults.parse_raw(fp.read())
        with self.captureOnCommitCallbacks(execute=True):
            head.delete()
        if objectstore:
            session = get_session(UsecaseId.PREPROD_SIZE, self.project)
            assert session.head(comparison.storage_path) is None
            assert session.head(head_metric.analysis_storage_path) is None
            assert session.head(base_metric.analysis_storage_path) is not None
