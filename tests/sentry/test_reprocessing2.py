from __future__ import annotations

from typing import Any
from unittest import mock

import pytest

from sentry import nodestore
from sentry.models.eventattachment import EventAttachment
from sentry.reprocessing2 import (
    UNPROCESSED_COPY_TTL,
    CannotReprocess,
    _maybe_copy_attachment_into_cache,
    backup_unprocessed_event,
    delete_unprocessed_backup,
    get_unprocessed_backup,
    pull_event_data,
)
from sentry.services.eventstore.models import Event
from sentry.services.eventstore.processing import event_processing_store
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.cache import cache_key_for_event


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


class UnprocessedCopyTest(TestCase):
    event_id = "a" * 32

    def _payload(self) -> dict[str, Any]:
        return {"event_id": self.event_id, "project": self.project.id, "platform": "native"}

    def _node_id(self) -> str:
        return Event.generate_unprocessed_node_id(self.project.id, self.event_id)

    @override_options({"store.reprocessing-nodestore-backup.rollout": 0.0})
    def test_backup_writes_to_processing_store(self) -> None:
        data = self._payload()
        backup_unprocessed_event(data)

        assert event_processing_store.get(cache_key_for_event(data), unprocessed=True) == data
        assert nodestore.backend.get(self._node_id()) is None

    @override_options({"store.reprocessing-nodestore-backup.rollout": 1.0})
    def test_backup_writes_to_nodestore(self) -> None:
        data = self._payload()
        backup_unprocessed_event(data)

        assert nodestore.backend.get(self._node_id()) == data
        assert event_processing_store.get(cache_key_for_event(data), unprocessed=True) is None

    def test_unprocessed_node_id_differs_from_event_node_id(self) -> None:
        assert self._node_id() != Event.generate_node_id(self.project.id, self.event_id)
        assert self._node_id().startswith(Event.generate_node_id(self.project.id, self.event_id))

    @override_options({"store.reprocessing-nodestore-backup.rollout": 1.0})
    def test_delete_removes_node(self) -> None:
        backup_unprocessed_event(self._payload())
        delete_unprocessed_backup(self.project.id, self.event_id)

        assert nodestore.backend.get(self._node_id()) is None

    def test_delete_without_node_is_noop(self) -> None:
        delete_unprocessed_backup(self.project.id, self.event_id)

        assert nodestore.backend.get(self._node_id()) is None

    @override_options({"store.reprocessing-nodestore-backup.rollout": 1.0})
    @mock.patch("sentry.reprocessing2.nodestore.backend.set")
    def test_backup_expires_before_the_event_does(self, mock_set: mock.Mock) -> None:
        backup_unprocessed_event(self._payload())

        assert mock_set.call_args.kwargs["ttl"] == UNPROCESSED_COPY_TTL

    @override_options({"store.reprocessing-nodestore-backup.rollout": 1.0})
    def test_get_returns_payload_without_removing_node(self) -> None:
        data = self._payload()
        backup_unprocessed_event(data)

        assert get_unprocessed_backup(self.project.id, self.event_id) == data
        assert nodestore.backend.get(self._node_id()) == data

    def test_get_without_node_returns_none(self) -> None:
        assert get_unprocessed_backup(self.project.id, self.event_id) is None


class PullEventDataTest(TestCase):
    event_id = "b" * 32

    def setUp(self) -> None:
        super().setUp()
        self.unprocessed = {
            "event_id": self.event_id,
            "project": self.project.id,
            "message": "unprocessed",
        }
        patcher = mock.patch("sentry.reprocessing2.eventstore.backend")
        backend = patcher.start()
        self.addCleanup(patcher.stop)
        backend.get_event_by_id.return_value = Event(
            project_id=self.project.id, event_id=self.event_id
        )

    def test_reads_subkey(self) -> None:
        nodestore.backend.set_subkeys(
            Event.generate_node_id(self.project.id, self.event_id),
            {None: {"message": "processed"}, "unprocessed": self.unprocessed},
        )

        assert pull_event_data(self.project.id, self.event_id).data == self.unprocessed

    def test_ignores_dedicated_node(self) -> None:
        nodestore.backend.set(
            Event.generate_unprocessed_node_id(self.project.id, self.event_id), self.unprocessed
        )

        with pytest.raises(CannotReprocess):
            pull_event_data(self.project.id, self.event_id)

    def test_raises_when_no_copy_exists(self) -> None:
        with pytest.raises(CannotReprocess):
            pull_event_data(self.project.id, self.event_id)
