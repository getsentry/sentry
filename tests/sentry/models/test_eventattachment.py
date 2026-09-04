from __future__ import annotations

import os
from unittest import mock
from uuid import uuid4

from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.attachments.base import CachedAttachment
from sentry.models.eventattachment import (
    EventAttachment,
    PendingEventAttachment,
    normalize_content_type,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class EventAttachmentDeleteTest(TestCase):
    def _create_v2_attachment(self) -> EventAttachment:
        return EventAttachment.objects.create(
            event_id=uuid4().hex,
            project_id=self.project.id,
            type="event.attachment",
            name="test.txt",
            blob_path="v2/some-key",
        )

    @mock.patch("sentry.models.eventattachment.get_session")
    @mock.patch("sentry.models.eventattachment._get_organization", return_value=1)
    def test_v2_delete_calls_objectstore(
        self,
        mock_get_org: mock.Mock,
        mock_get_session: mock.Mock,
    ) -> None:
        attachment = self._create_v2_attachment()

        attachment.delete()

        mock_get_session.return_value.delete.assert_called_once_with("some-key")

    @mock.patch("sentry.models.eventattachment.get_session")
    @mock.patch("sentry.models.eventattachment._get_organization", return_value=1)
    def test_v2_delete_skips_objectstore_during_cleanup(
        self,
        mock_get_org: mock.Mock,
        mock_get_session: mock.Mock,
    ) -> None:
        attachment = self._create_v2_attachment()

        os.environ["_SENTRY_CLEANUP"] = "1"
        try:
            attachment.delete()
        finally:
            del os.environ["_SENTRY_CLEANUP"]

        mock_get_session.return_value.delete.assert_not_called()
        assert not EventAttachment.objects.filter(id=attachment.id).exists()


class PendingEventAttachmentDeleteTest(TestCase):
    """
    `cleanup` deletes pending attachments through a stale instance: it selects ids in one
    pass and deletes them in a later one. `save_pending_attachments` can promote the row
    in between, handing the blob to the `EventAttachment` it creates -- so deleting the
    blob is only safe while we still own the row.
    """

    def _create_pending(self) -> PendingEventAttachment:
        return PendingEventAttachment.objects.create(
            event_id=uuid4().hex,
            project_id=self.project.id,
            type="event.attachment",
            name="test.txt",
            blob_path="eventattachments/v1/some-key",
        )

    @mock.patch("sentry.models.eventattachment.get_storage")
    def test_delete_removes_the_blob_it_still_owns(self, mock_get_storage: mock.Mock) -> None:
        pending = self._create_pending()

        pending.delete()

        assert not PendingEventAttachment.objects.filter(id=pending.id).exists()
        mock_get_storage.return_value.delete.assert_called_once_with("eventattachments/v1/some-key")

    @mock.patch("sentry.models.eventattachment.get_storage")
    def test_delete_keeps_the_blob_a_promotion_took_over(self, mock_get_storage: mock.Mock) -> None:
        pending = self._create_pending()

        # Promotion, as `save_pending_attachments` performs it: the blob moves to a new
        # `EventAttachment`, and the pending row goes away via a queryset delete so that
        # `Model.delete` -- and with it `delete_blob` -- never runs.
        promoted = EventAttachment.objects.create(
            event_id=pending.event_id,
            project_id=pending.project_id,
            type=pending.type,
            name=pending.name,
            blob_path=pending.blob_path,
        )
        PendingEventAttachment.objects.filter(id=pending.id).delete()

        # `pending` is now the stale instance `cleanup` is holding.
        pending.delete()

        mock_get_storage.return_value.delete.assert_not_called()
        assert EventAttachment.objects.filter(id=promoted.id).exists()

    def test_delete_locks_the_row_before_dropping_the_blob(self) -> None:
        pending = self._create_pending()

        with (
            mock.patch("sentry.models.eventattachment.get_storage"),
            CaptureQueriesContext(
                connections[router.db_for_write(PendingEventAttachment)]
            ) as queries,
        ):
            pending.delete()

        claims = [
            q["sql"]
            for q in queries.captured_queries
            if "sentry_pendingeventattachment" in q["sql"] and "FOR UPDATE" in q["sql"]
        ]
        assert len(claims) == 1, [q["sql"] for q in queries.captured_queries]


class EventAttachmentPutfileTest(TestCase):
    @mock.patch("sentry.models.eventattachment.get_session")
    @mock.patch("sentry.models.eventattachment._get_organization", return_value=1)
    @override_options({"objectstore.enable_for.attachments": 1})
    def test_objectstore_upload_stores_filename(
        self,
        mock_get_org: mock.Mock,
        mock_get_session: mock.Mock,
    ) -> None:
        mock_get_session.return_value.put.return_value = "some-key"

        result = EventAttachment.putfile(
            self.project.id,
            # Long enough that it cannot be stored inline.
            CachedAttachment(name="hello.png", content_type="image/png", data=b"x" * 200),
        )

        assert result.blob_path == "v2/some-key"
        assert mock_get_session.return_value.put.call_args.kwargs["filename"] == "hello.png"
        assert mock_get_session.return_value.put.call_args.kwargs["content_type"] == "image/png"

    @mock.patch("sentry.models.eventattachment.get_session")
    @mock.patch("sentry.models.eventattachment._get_organization", return_value=1)
    @override_options({"objectstore.enable_for.attachments": 1})
    def test_objectstore_upload_stores_normalized_content_type(
        self,
        mock_get_org: mock.Mock,
        mock_get_session: mock.Mock,
    ) -> None:
        mock_get_session.return_value.put.return_value = "some-key"

        result = EventAttachment.putfile(
            self.project.id,
            # Long enough that it cannot be stored inline.
            CachedAttachment(
                name="one.txt", content_type="application/octet-stream", data=b"x" * 200
            ),
        )

        # The uninformative `application/octet-stream` is upgraded from the filename, and
        # objectstore must record the same value as the `content_type` column.
        assert result.content_type == "text/plain"
        assert mock_get_session.return_value.put.call_args.kwargs["content_type"] == "text/plain"


class NormalizeContentTypeTest(TestCase):
    def test_returns_explicit_content_type(self):
        assert normalize_content_type("image/png", "file.png") == "image/png"

    def test_strips_charset_from_content_type(self):
        assert normalize_content_type("text/plain; charset=utf-8", "file.txt") == "text/plain"

    def test_infers_from_filename_when_none(self):
        assert normalize_content_type(None, "screenshot.png") == "image/png"

    def test_infers_from_filename_when_octet_stream(self):
        assert normalize_content_type("application/octet-stream", "screenshot.png") == "image/png"

    def test_falls_back_to_octet_stream_when_unrecognized(self):
        assert normalize_content_type(None, "data.bin") == "application/octet-stream"

    def test_octet_stream_with_unrecognized_name(self):
        assert (
            normalize_content_type("application/octet-stream", "noext")
            == "application/octet-stream"
        )

    def test_octet_stream_case_insensitive(self):
        assert normalize_content_type("Application/Octet-Stream", "screenshot.png") == "image/png"
