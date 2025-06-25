from unittest.mock import patch

import orjson
from django.test import override_settings

from sentry.models.files.fileblob import FileBlob
from sentry.preprod.models import PreprodArtifact
from sentry.tasks.assemble import AssembleTask, ChunkFileState, set_assemble_status
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import TestCase


class ProjectPreprodArtifactAssembleSizeAnalysisEndpointTest(TestCase):
    def setUp(self):
        super().setUp()
        self.preprod_artifact = PreprodArtifact.objects.create(
            project=self.project, state=PreprodArtifact.ArtifactState.UPLOADED
        )

    def _get_url(self, artifact_id=None):
        artifact_id = artifact_id or self.preprod_artifact.id
        return f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{artifact_id}/assemble-size-analysis/"

    def _make_request(self, data, artifact_id=None, authenticated=True):
        url = self._get_url(artifact_id)
        json_data = orjson.dumps(data) if isinstance(data, dict) else data

        kwargs = {"data": json_data, "content_type": "application/json"}
        if authenticated:
            signature = generate_service_request_signature(
                url, json_data, ["test-secret-key"], "Launchpad"
            )
            kwargs["HTTP_AUTHORIZATION"] = f"rpcsignature {signature}"

        with self.feature("organizations:preprod-artifact-assemble"):
            return self.client.post(url, **kwargs)

    def _create_blobs(self, count=2):
        return [
            FileBlob.from_file_with_organization(
                self.create_file(name=f"chunk{i}", type="application/octet-stream").getfile(),
                self.organization,
            )
            for i in range(count)
        ]

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_assemble_size_analysis_success(self):
        blobs = self._create_blobs()
        data = {"checksum": "a" * 40, "chunks": [b.checksum for b in blobs]}

        with patch(
            "sentry.preprod.api.endpoints.project_preprod_artifact_assemble_size_analysis.assemble_preprod_artifact_size_analysis.apply_async"
        ) as mock_task:
            response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["state"] == ChunkFileState.CREATED
        assert resp_data["missingChunks"] == []

        # Verify task parameters
        call_kwargs = mock_task.call_args[1]["kwargs"]
        assert call_kwargs["org_id"] == self.organization.id
        assert call_kwargs["project_id"] == self.project.id
        assert call_kwargs["checksum"] == "a" * 40
        assert call_kwargs["chunks"] == [b.checksum for b in blobs]
        assert call_kwargs["artifact_id"] == str(self.preprod_artifact.id)

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_assemble_size_analysis_missing_chunks(self):
        data = {
            "checksum": "b" * 40,
            "chunks": ["c" * 40, "d" * 40],
        }  # Valid chunks that don't exist
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["state"] == ChunkFileState.NOT_FOUND
        assert len(resp_data["missingChunks"]) == 2

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_assemble_size_analysis_existing_status(self):
        # First, create a blob to avoid validation errors
        blob = self._create_blobs(1)[0]
        checksum = "c" * 40

        # Set the status first
        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
            self.project.id,
            checksum,
            ChunkFileState.ASSEMBLING,
            detail="Processing",
        )

        # Now make the request with valid chunks
        response = self._make_request({"checksum": checksum, "chunks": [blob.checksum]})

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["state"] == ChunkFileState.ASSEMBLING
        assert resp_data["detail"] == "Processing"

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_assemble_size_analysis_empty_chunks(self):
        response = self._make_request({"checksum": "e" * 40, "chunks": []})

        assert response.status_code == 200
        assert response.json()["state"] == ChunkFileState.NOT_FOUND

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_assemble_size_analysis_validation_errors(self):
        test_cases = [
            (b"invalid json", "Invalid json body"),
            ({"chunks": ["f" * 40]}, "checksum"),  # Missing checksum
            ({"checksum": "g" * 40}, "chunks"),  # Missing chunks
            ({"checksum": "invalid", "chunks": ["h" * 40]}, "checksum"),  # Invalid checksum format
            (
                {"checksum": "a" * 40, "chunks": ["invalid"]},
                "chunks",
            ),  # Invalid chunk format - fixed checksum to be valid hex
            (
                {"checksum": "j" * 40, "chunks": ["k" * 40], "extra": "field"},
                "Additional properties are not allowed",
            ),  # Extra properties
        ]

        for data, expected_error in test_cases:
            response = self._make_request(data)
            assert response.status_code == 400
            assert expected_error.lower() in response.json()["error"].lower()

    def test_assemble_size_analysis_unauthorized(self):
        response = self._make_request(
            {"checksum": "m" * 40, "chunks": ["n" * 40]}, authenticated=False
        )
        assert response.status_code == 403

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_assemble_size_analysis_nonexistent_artifact(self):
        blob = self._create_blobs(1)[0]
        data = {"checksum": "o" * 40, "chunks": [blob.checksum]}

        response = self._make_request(data, artifact_id=99999)

        assert response.status_code == 400
        assert "error" in response.json()
