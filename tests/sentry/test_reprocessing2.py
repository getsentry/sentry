from __future__ import annotations

from unittest import mock

from sentry.models.eventattachment import EventAttachment
from sentry.reprocessing2 import _maybe_copy_attachment_into_cache
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class MaybeCopyAttachmentIntoCacheTest(TestCase):
    def _create_inline_attachment(self) -> EventAttachment:
        return EventAttachment.objects.create(
            event_id="a" * 32,
            project_id=self.project.id,
            type="event.attachment",
            name="one.log",
            content_type="text/plain",
            size=5,
            blob_path=":hello",
        )

    @mock.patch("sentry.reprocessing2.get_attachments_session")
    @override_options({"objectstore.enable_for.attachments": 1})
    def test_objectstore_upload_stores_content_type(self, mock_get_session: mock.Mock) -> None:
        mock_get_session.return_value.put.return_value = "some-key"
        attachment = self._create_inline_attachment()

        cached = _maybe_copy_attachment_into_cache(
            self.project, 0, attachment, "cache-key", cache_timeout=3600
        )

        put_kwargs = mock_get_session.return_value.put.call_args.kwargs
        assert put_kwargs["content_type"] == "text/plain"
        assert put_kwargs["filename"] == "one.log"

        assert cached.stored_id == "some-key"
        attachment.refresh_from_db()
        assert attachment.blob_path == "v2/some-key"
