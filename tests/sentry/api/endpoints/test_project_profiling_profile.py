from io import BytesIO
from typing import Any
from unittest.mock import Mock, patch
from uuid import uuid4

import vroomrs

from sentry.testutils.cases import APITestCase

PROFILING_FEATURES = {"organizations:profiling": True}


class ProjectProfilingProfileTest(APITestCase):
    endpoint = "sentry-api-0-project-profiling-profile"

    def setUp(self) -> None:
        self.login_as(user=self.user)

    def test_feature_flag_disabled(self) -> None:
        response = self.get_response(self.project.organization.slug, self.project.id, str(uuid4()))
        assert response.status_code == 404


class ProjectProfilingChunkAttachmentTest(APITestCase):
    endpoint = "sentry-api-0-project-profiling-chunk-attachment"

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.profiler_id = uuid4().hex
        self.chunk_id = uuid4().hex
        self.chunk_path = (
            f"{self.organization.id}/{self.project.id}/{self.profiler_id}/{self.chunk_id}"
        )

    def get_attachment_response(self, attachment_name: str = "raw_profile") -> Any:
        return self.get_response(
            self.organization.slug,
            self.project.slug,
            self.profiler_id,
            self.chunk_id,
            attachment_name,
        )

    def make_chunk(self, attachments: list[vroomrs.Attachment]) -> Mock:
        chunk = Mock()
        chunk.get_attachments.return_value = attachments
        return chunk

    def make_storage(self, chunk_exists: bool, stored_files: dict[str, bytes]) -> Mock:
        storage = Mock()
        storage.exists.return_value = chunk_exists

        def open_(path: str) -> BytesIO:
            if path == self.chunk_path and chunk_exists:
                return BytesIO(b"compressed-chunk")
            if path in stored_files:
                return BytesIO(stored_files[path])
            raise OSError(f"no such object: {path}")

        storage.open.side_effect = open_
        return storage

    def test_feature_flag_disabled(self) -> None:
        response = self.get_attachment_response()
        assert response.status_code == 404

    @patch("sentry.api.endpoints.project_profiling_profile.vroomrs")
    @patch("sentry.api.endpoints.project_profiling_profile.get_profiles_storage")
    def test_download(self, mock_get_storage: Mock, mock_vroomrs: Mock) -> None:
        storage = self.make_storage(True, {"aef123345": b"raw-profile-bytes"})
        mock_get_storage.return_value = storage
        mock_vroomrs.decompress_profile_chunk.return_value = self.make_chunk(
            [
                vroomrs.Attachment(
                    name="raw_profile",
                    content_type="application/x-perfetto-trace",
                    stored_id="aef123345",
                )
            ]
        )

        with self.feature("organizations:continuous-profiling"):
            response = self.get_attachment_response()

        assert response.status_code == 200
        assert b"".join(response.streaming_content) == b"raw-profile-bytes"
        assert response["Content-Type"] == "application/x-perfetto-trace"
        assert response["Content-Disposition"] == 'attachment; filename="raw_profile"'
        storage.exists.assert_called_once_with(self.chunk_path)

    @patch("sentry.api.endpoints.project_profiling_profile.vroomrs")
    @patch("sentry.api.endpoints.project_profiling_profile.get_profiles_storage")
    def test_download_without_content_type_falls_back_to_octet_stream(
        self, mock_get_storage: Mock, mock_vroomrs: Mock
    ) -> None:
        mock_get_storage.return_value = self.make_storage(True, {"aef123345": b"trace"})
        mock_vroomrs.decompress_profile_chunk.return_value = self.make_chunk(
            [vroomrs.Attachment(name="raw_profile", content_type=None, stored_id="aef123345")]
        )

        with self.feature("organizations:continuous-profiling"):
            response = self.get_attachment_response()

        assert response.status_code == 200
        assert response["Content-Type"] == "application/octet-stream"

    @patch("sentry.api.endpoints.project_profiling_profile.vroomrs")
    @patch("sentry.api.endpoints.project_profiling_profile.get_profiles_storage")
    def test_unknown_attachment_name_returns_404(
        self, mock_get_storage: Mock, mock_vroomrs: Mock
    ) -> None:
        mock_get_storage.return_value = self.make_storage(True, {"aef123345": b"trace"})
        mock_vroomrs.decompress_profile_chunk.return_value = self.make_chunk(
            [
                vroomrs.Attachment(
                    name="raw_profile",
                    content_type="application/x-perfetto-trace",
                    stored_id="aef123345",
                )
            ]
        )

        with self.feature("organizations:continuous-profiling"):
            response = self.get_attachment_response("some_other_attachment")

        assert response.status_code == 404

    @patch("sentry.api.endpoints.project_profiling_profile.vroomrs")
    @patch("sentry.api.endpoints.project_profiling_profile.get_profiles_storage")
    def test_chunk_without_attachments_returns_404(
        self, mock_get_storage: Mock, mock_vroomrs: Mock
    ) -> None:
        mock_get_storage.return_value = self.make_storage(True, {})
        mock_vroomrs.decompress_profile_chunk.return_value = self.make_chunk([])

        with self.feature("organizations:continuous-profiling"):
            response = self.get_attachment_response()

        assert response.status_code == 404

    @patch("sentry.api.endpoints.project_profiling_profile.vroomrs")
    @patch("sentry.api.endpoints.project_profiling_profile.get_profiles_storage")
    def test_missing_chunk_returns_404(self, mock_get_storage: Mock, mock_vroomrs: Mock) -> None:
        storage = self.make_storage(False, {})
        mock_get_storage.return_value = storage

        with self.feature("organizations:continuous-profiling"):
            response = self.get_attachment_response()

        assert response.status_code == 404
        storage.open.assert_not_called()
        mock_vroomrs.decompress_profile_chunk.assert_not_called()

    @patch("sentry.api.endpoints.project_profiling_profile.vroomrs")
    @patch("sentry.api.endpoints.project_profiling_profile.get_profiles_storage")
    def test_missing_attachment_file_returns_404(
        self, mock_get_storage: Mock, mock_vroomrs: Mock
    ) -> None:
        # The attachment is referenced by the chunk but the file is gone from
        # the object store.
        mock_get_storage.return_value = self.make_storage(True, {})
        mock_vroomrs.decompress_profile_chunk.return_value = self.make_chunk(
            [
                vroomrs.Attachment(
                    name="raw_profile",
                    content_type="application/x-perfetto-trace",
                    stored_id="aef123345",
                )
            ]
        )

        with self.feature("organizations:continuous-profiling"):
            response = self.get_attachment_response()

        assert response.status_code == 404
