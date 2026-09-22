from datetime import timedelta
from io import BytesIO
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from objectstore_client import TimeToIdle
from PIL import Image

from sentry.objectstore import UsecaseId, get_org_session
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
        for names in ([], ["a.md", "b.md"]):
            response = self.client.post(
                self.url,
                {"file": [SimpleUploadedFile(name, b"text") for name in names]},
                format="multipart",
            )
            assert response.status_code == 400
            assert response.data["code"] == "invalid_upload"

    @patch("sentry.seer.attachments.storage.put")
    def test_flag_disabled_upload(self, put):
        response = self.client.post(
            self.url, {"file": SimpleUploadedFile("file.md", b"hello")}, format="multipart"
        )
        assert response.status_code == 403
        put.assert_not_called()

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
    def test_preview_headers(self, read):
        read.return_value = (
            b"<script>test</script>",
            Attachment("file.md", "text/markdown", 21, "markdown"),
        )
        response = self.client.get(f"{self.url}key/content/", HTTP_RANGE="bytes=0-1")
        assert response.status_code == 200
        assert response["Content-Type"] == "text/plain; charset=utf-8"
        assert response["X-Content-Type-Options"] == "nosniff"
        assert response["Cache-Control"] == "private, no-store"
        assert response["Content-Disposition"] == 'inline; filename="file.md"'
        assert "Content-Range" not in response
        assert response.content == b"<script>test</script>"

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
        assert response.content == b"x"
        assert limited.call_args_list[:3] == limited.call_args_list[3:]

    @requires_objectstore
    @patch("sentry.seer.endpoints.organization_seer_attachments.scan_image")
    def test_upload_and_org_scoped_reads_with_uploads_disabled(self, scan):
        data = b"{not valid json, untouched\r\n"
        attachment = Attachment("original.JSON", "application/json", len(data), "json")
        with self.feature("organizations:seer-explorer-attachments"):
            upload = self.client.post(
                self.url,
                {"file": SimpleUploadedFile(attachment.filename, data, "text/plain")},
                format="multipart",
            )
        assert upload.status_code == 201
        key = upload.data["key"]
        store = get_org_session(UsecaseId.SEER_ATTACHMENTS, self.organization.id, timeout=5)
        other = self.create_organization(owner=self.user)
        other.flags.allow_joinleave = True
        other.save()
        other_url = f"/api/0/organizations/{other.slug}/seer/explorer-attachments/"
        try:
            assert upload.data == attachment.response(key)
            scan.assert_not_called()
            stored = store.head(key)
            assert stored is not None
            assert (stored.filename, stored.content_type, stored.size) == (
                attachment.filename,
                attachment.content_type,
                len(data),
            )
            assert stored.compression is None
            assert stored.expiration_policy == TimeToIdle(timedelta(days=91))
            assert stored.custom == attachment.custom_metadata()
            own = self.client.get(self.url, {"key": [key, "missing"]})
            assert own.status_code == 200
            assert own.data == {"attachments": [attachment.response(key)], "missing": ["missing"]}
            foreign = self.client.get(other_url, {"key": key})
            assert foreign.status_code == 200
            assert foreign.data == {"attachments": [], "missing": [key]}
            missing = self.client.get(f"{other_url}{key}/content/")
            assert missing.status_code == 404
            assert missing.data["code"] == "attachment_missing"
            content = self.client.get(f"{self.url}{key}/content/")
            assert content.status_code == 200
            assert content.content == data
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
    assert set(attachment["required"]) == {"key", "filename", "contentType", "size", "kind"}
    assert schema["components"]["schemas"]["AttachmentUpload"]["properties"]["file"] == {
        "type": "string",
        "format": "binary",
    }
