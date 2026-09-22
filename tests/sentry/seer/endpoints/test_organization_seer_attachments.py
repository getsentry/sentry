from io import BytesIO
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from sentry.seer.attachments.models import Attachment, AttachmentError
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.skips import requires_objectstore


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
class OrganizationSeerAttachmentsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.login_as(self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-attachments/"

    @with_feature("organizations:seer-explorer-attachments")
    @patch("sentry.seer.attachments.storage.put", return_value="key")
    @patch("sentry.seer.endpoints.organization_seer_attachments.scan_image")
    def test_upload_text(self, scan, put):
        response = self.client.post(
            self.url,
            {"file": SimpleUploadedFile("file.JSON", b"invalid json", "text/plain")},
            format="multipart",
        )
        assert response.status_code == 201
        assert response.data == {
            "key": "key",
            "filename": "file.JSON",
            "contentType": "application/json",
            "size": 12,
            "kind": "json",
        }
        scan.assert_not_called()
        assert put.call_args.args[0] == b"invalid json"

    @with_feature("organizations:seer-explorer-attachments")
    @patch("sentry.seer.attachments.storage.put", return_value="key")
    @patch("sentry.seer.endpoints.organization_seer_attachments.scan_image")
    def test_scan_before_write(self, scan, put):
        data = BytesIO()
        Image.new("RGB", (2, 3)).save(data, format="PNG")
        calls = Mock()
        calls.attach_mock(scan, "scan")
        calls.attach_mock(put, "put")
        response = self.client.post(
            self.url, {"file": SimpleUploadedFile("image.bin", data.getvalue())}, format="multipart"
        )
        assert response.status_code == 201
        assert response.data["width"] == 2
        assert response.data["height"] == 3
        assert [call[0] for call in calls.mock_calls] == ["scan", "put"]
        scan.assert_called_once_with(data.getvalue())

    @with_feature("organizations:seer-explorer-attachments")
    @patch("sentry.seer.attachments.storage.put")
    def test_scan_failure_never_stored(self, put):
        data = BytesIO()
        Image.new("RGB", (2, 3)).save(data, format="PNG")
        with patch(
            "sentry.seer.endpoints.organization_seer_attachments.scan_image",
            side_effect=AttachmentError("scan_inconclusive", "Try again.", 503),
        ):
            response = self.client.post(
                self.url,
                {"file": SimpleUploadedFile("image.png", data.getvalue())},
                format="multipart",
            )
        assert response.status_code == 503
        assert response.data == {"detail": "Try again.", "code": "scan_inconclusive"}
        put.assert_not_called()

    @with_feature("organizations:seer-explorer-attachments")
    @patch("sentry.seer.attachments.storage.put")
    def test_validation_failure_never_stored(self, put):
        response = self.client.post(
            self.url, {"file": SimpleUploadedFile("file.md", b"\xff")}, format="multipart"
        )
        assert response.status_code == 400
        assert response.data["code"] == "invalid_utf8"
        put.assert_not_called()

    @with_feature("organizations:seer-explorer-attachments")
    def test_exactly_one_file(self):
        response = self.client.post(
            self.url,
            {"file": [SimpleUploadedFile("a.md", b"a"), SimpleUploadedFile("b.md", b"b")]},
            format="multipart",
        )
        assert response.status_code == 400
        assert response.data["code"] == "invalid_upload"

    @with_feature("organizations:seer-explorer-attachments")
    def test_missing_file(self):
        response = self.client.post(self.url, {}, format="multipart")
        assert response.status_code == 400
        assert response.data["code"] == "invalid_upload"

    @patch("sentry.seer.attachments.storage.put")
    def test_flag_disabled_upload(self, put):
        response = self.client.post(
            self.url, {"file": SimpleUploadedFile("file.md", b"hello")}, format="multipart"
        )
        assert response.status_code == 403
        put.assert_not_called()

    @patch("sentry.seer.attachments.storage.metadata_batch", return_value=([], ["missing"]))
    def test_flag_disabled_reads_work(self, batch):
        response = self.client.get(self.url, {"key": ["missing"]})
        assert response.status_code == 200
        assert response.data == {"attachments": [], "missing": ["missing"]}
        batch.assert_called_once_with(["missing"])

    @patch("sentry.seer.attachments.storage.metadata_batch")
    def test_explorer_access_required(self, batch):
        with self.feature({"organizations:seer-explorer": False}):
            response = self.client.get(self.url, {"key": "key"})
        assert response.status_code == 403
        batch.assert_not_called()

    @patch("sentry.seer.attachments.storage.metadata_batch")
    def test_organization_membership_required(self, batch):
        other = self.create_organization()
        response = self.client.get(
            f"/api/0/organizations/{other.slug}/seer/explorer-attachments/", {"key": "key"}
        )
        assert response.status_code == 403
        batch.assert_not_called()

    @patch("sentry.seer.attachments.storage.read")
    def test_preview_headers_and_cleanup(self, read):
        read.return_value = (
            b"<script>test</script>",
            Attachment("file.md", "text/markdown", 21, "markdown"),
        )
        response = self.client.get(f"{self.url}key/content/", HTTP_RANGE="bytes=0-1")
        assert response.status_code == 200
        assert response["Content-Type"] == "text/plain; charset=utf-8"
        assert response["X-Content-Type-Options"] == "nosniff"
        assert response["Cache-Control"] == "private, no-store"
        assert "Content-Range" not in response
        assert b"".join(response.streaming_content) == b"<script>test</script>"

    @patch("sentry.seer.attachments.storage.read")
    def test_preview_closed_without_iteration(self, read):
        read.return_value = (b"hello", Attachment("file.json", "application/json", 5, "json"))
        from rest_framework.request import Request
        from rest_framework.test import APIRequestFactory

        from sentry.seer.endpoints.organization_seer_attachments import (
            OrganizationSeerAttachmentContentEndpoint,
        )

        request = Request(APIRequestFactory().get(self.url))
        with patch("sentry.seer.endpoints.organization_seer_attachments.require_explorer"):
            response = OrganizationSeerAttachmentContentEndpoint().get(
                request, self.organization, "key"
            )
        stream = response.file_to_stream
        with patch("django.http.response.signals.request_finished.send"):
            response.close()
        assert stream.closed

    @patch(
        "sentry.seer.attachments.storage.read",
        side_effect=AttachmentError("attachment_missing", "Missing.", 404),
    )
    def test_missing_preview(self, read):
        response = self.client.get(f"{self.url}missing/content/")
        assert response.status_code == 404
        assert response.data["code"] == "attachment_missing"

    def test_preview_rejects_url_key(self):
        response = self.client.get(f"{self.url}https:evil/content/")
        assert response.status_code == 400
        assert response.data["code"] == "invalid_key"

    @patch("sentry.seer.attachments.storage.metadata_batch")
    @patch("sentry.seer.endpoints.organization_seer_attachments.ratelimits.backend.is_limited")
    def test_read_rate_limited_before_storage(self, limited, batch):
        limited.side_effect = [False, False, True]
        response = self.client.get(self.url, {"key": "key"})
        assert response.status_code == 429
        assert response.data["code"] == "rate_limited"
        batch.assert_not_called()
        assert [(c.kwargs["limit"], c.kwargs["window"]) for c in limited.call_args_list] == [
            (1000, 60),
            (100, 60),
            (100, 60),
        ]

    @with_feature("organizations:seer-explorer-attachments")
    @patch("sentry.seer.attachments.storage.put")
    @patch("sentry.seer.endpoints.organization_seer_attachments.ratelimits.backend.is_limited")
    def test_upload_rate_limited_before_storage(self, limited, put):
        limited.side_effect = [False, False, True]
        response = self.client.post(
            self.url, {"file": SimpleUploadedFile("x.md", b"x")}, format="multipart"
        )
        assert response.status_code == 429
        put.assert_not_called()
        assert [(c.kwargs["limit"], c.kwargs["window"]) for c in limited.call_args_list] == [
            (500, 3600),
            (125, 60),
            (125, 60),
        ]

    @patch("sentry.seer.attachments.storage.metadata_batch", return_value=([], []))
    @patch(
        "sentry.seer.attachments.storage.read",
        return_value=(b"x", Attachment("x.md", "text/markdown", 1, "markdown")),
    )
    @patch(
        "sentry.seer.endpoints.organization_seer_attachments.ratelimits.backend.is_limited",
        return_value=False,
    )
    def test_metadata_and_content_share_read_quotas(self, limited, read, batch):
        assert self.client.get(self.url, {"key": "key"}).status_code == 200
        response = self.client.get(f"{self.url}key/content/")
        assert response.status_code == 200
        assert b"".join(response.streaming_content) == b"x"
        assert limited.call_args_list[:3] == limited.call_args_list[3:]

    @requires_objectstore
    def test_reads_are_organization_scoped(self):
        from sentry.objectstore import UsecaseId, get_org_session

        store = get_org_session(UsecaseId.SEER_ATTACHMENTS, self.organization.id, timeout=5)
        attachment = Attachment("x.md", "text/markdown", 5, "markdown")
        key = store.put(
            b"hello",
            filename=attachment.filename,
            content_type=attachment.content_type,
            metadata=attachment.custom_metadata(),
        )
        other = self.create_organization(owner=self.user)
        other.flags.allow_joinleave = True
        other.save()
        other_url = f"/api/0/organizations/{other.slug}/seer/explorer-attachments/"
        try:
            own = self.client.get(self.url, {"key": [key, "missing"]})
            assert own.status_code == 200
            assert own.data == {"attachments": [attachment.response(key)], "missing": ["missing"]}
            foreign = self.client.get(other_url, {"key": key})
            assert foreign.status_code == 200
            assert foreign.data == {"attachments": [], "missing": [key]}
            assert self.client.get(f"{other_url}{key}/content/").status_code == 404
            content = self.client.get(f"{self.url}{key}/content/")
            assert content.status_code == 200
            assert b"".join(content.streaming_content) == b"hello"
        finally:
            store.delete(key)


def test_attachment_api_schema():
    import sentry.apidocs.extensions  # noqa: F401
    from sentry.seer.endpoints.organization_seer_attachments import (
        OrganizationSeerAttachmentsEndpoint,
    )
    from tests.sentry.apidocs import generate_schema

    schema = generate_schema(
        "organizations/{organization_id_or_slug}/seer/explorer-attachments/",
        view=OrganizationSeerAttachmentsEndpoint,
    )
    attachment = schema["components"]["schemas"]["ExplorerAttachment"]
    assert attachment["properties"]["key"]["type"] == "string"
    assert set(attachment["required"]) == {"key", "filename", "contentType", "size", "kind"}
    assert set(attachment["properties"]) == {
        "key",
        "filename",
        "contentType",
        "size",
        "kind",
        "width",
        "height",
        "pageCount",
    }
    assert schema["components"]["schemas"]["AttachmentUpload"]["properties"]["file"] == {
        "type": "string",
        "format": "binary",
    }
