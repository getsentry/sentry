from __future__ import annotations

from unittest import mock

import pytest

from sentry.models.eventattachment import EventAttachment
from sentry.reprocessing2 import (
    ReprocessableEvent,
    _maybe_copy_attachment_into_cache,
    reprocess_event,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
@pytest.mark.parametrize(
    "rate,disable_store,expected_writes", [(0.0, True, 1), (1.0, False, 1), (1.0, True, 0)]
)
def test_reprocessing_conditions_working_payload_write(
    default_project,
    rate,
    disable_store,
    expected_writes,
):
    event_id = "a" * 32
    data = {"event_id": event_id, "project": default_project.id}
    event = mock.Mock(group_id=123)
    event.get_primary_hash.return_value = "original-hash"
    with (
        override_options(
            {"store.enable-inline-payloads": rate, "store.disable-processing-store": disable_store}
        ),
        mock.patch(
            "sentry.reprocessing2.pull_event_data",
            return_value=ReprocessableEvent(event=event, data=data, attachments=[]),
        ),
        mock.patch(
            "sentry.reprocessing2.event_processing_store.store", return_value="e:reprocessing"
        ) as store,
        mock.patch("sentry.tasks.store.preprocess_event_from_reprocessing") as preprocess,
    ):
        reprocess_event(default_project.id, event_id, start_time=1.0)

    assert store.call_count == expected_writes
    assert bool(preprocess.call_args.kwargs["cache_key"]) is bool(expected_writes)
    assert preprocess.call_args.kwargs["data"] is data


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

    @mock.patch("sentry.reprocessing2.get_session")
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
