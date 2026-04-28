from __future__ import annotations

import pickle
import zlib
from collections.abc import Iterator
from datetime import datetime, timezone
from unittest import mock
from unittest.mock import Mock

import pytest

from sentry.digests.codecs import _ZSTD_MAGIC, CompressedJsonCodec, CompressedPickleCodec
from sentry.digests.types import IdentifierKey, Notification
from sentry.models.event import GroupEvent
from sentry.models.group import Group
from sentry.services.eventstore.models import Event
from sentry.testutils.helpers.options import override_options


def _make_notification(
    *,
    project_id: int = 1,
    event_id: str = "abc123",
    group_id: int = 42,
    timestamp: float = 1700000000.0,
    rules: list[int] | None = None,
    notification_uuid: str | None = "notif-uuid-1",
    identifier_key: IdentifierKey = IdentifierKey.RULE,
) -> Notification:
    event = Event(
        project_id=project_id,
        event_id=event_id,
        group_id=group_id,
        data={"timestamp": timestamp},
    )
    return Notification(
        event=event,
        rules=rules if rules is not None else [1, 2],
        notification_uuid=notification_uuid,
        identifier_key=identifier_key,
    )


def _assert_notifications_equal(decoded: Notification, original: Notification) -> None:
    assert decoded.event.project_id == original.event.project_id
    assert decoded.event.event_id == original.event.event_id
    assert decoded.event.group_id == original.event.group_id
    assert decoded.event.datetime == original.event.datetime
    assert list(decoded.rules) == list(original.rules)
    assert decoded.notification_uuid == original.notification_uuid
    assert decoded.identifier_key == original.identifier_key


class TestCompressedJsonCodec:
    codec: CompressedJsonCodec = CompressedJsonCodec()

    @pytest.fixture(autouse=True)
    def _mock_eventstore(self) -> Iterator[None]:
        """Stub eventstore so decode can fetch events without Snuba."""
        self._events: dict[tuple[int, str], Event | GroupEvent] = {}

        def fake_get_event_by_id(project_id: int, event_id: str, **kwargs: object) -> Event | None:
            return self._events.get((project_id, event_id))

        with mock.patch(
            "sentry.eventstore.backend.get_event_by_id", side_effect=fake_get_event_by_id
        ):
            yield

    def _register(self, notification: Notification) -> None:
        e = notification.event
        self._events[(e.project_id, e.event_id)] = e

    def test_round_trip(self) -> None:
        original = _make_notification()
        self._register(original)
        decoded = self.codec.decode(self.codec.encode(original))
        _assert_notifications_equal(decoded, original)

    def test_round_trip_workflow_identifier_key(self) -> None:
        original = _make_notification(identifier_key=IdentifierKey.WORKFLOW)
        self._register(original)
        decoded = self.codec.decode(self.codec.encode(original))
        assert decoded.identifier_key == IdentifierKey.WORKFLOW

    def test_round_trip_none_notification_uuid(self) -> None:
        original = _make_notification(notification_uuid=None)
        self._register(original)
        decoded = self.codec.decode(self.codec.encode(original))
        assert decoded.notification_uuid is None

    def test_round_trip_empty_rules(self) -> None:
        original = _make_notification(rules=[])
        self._register(original)
        decoded = self.codec.decode(self.codec.encode(original))
        assert list(decoded.rules) == []

    def test_decoded_event_datetime(self) -> None:
        ts = 1700000000.0
        original = _make_notification(timestamp=ts)
        self._register(original)
        decoded = self.codec.decode(self.codec.encode(original))
        expected = datetime.fromtimestamp(ts, tz=timezone.utc)
        assert decoded.event.datetime == expected

    def test_decoded_event_group_setter(self) -> None:
        """Verify the decoded Event supports the .group setter used by _bind_records."""
        original = _make_notification()
        self._register(original)
        decoded = self.codec.decode(self.codec.encode(original))

        group = Mock(spec=Group, id=99)
        decoded.event.group = group
        assert decoded.event.group_id == 99

    def test_encoded_starts_with_zstd_magic(self) -> None:
        encoded = self.codec.encode(_make_notification())
        assert encoded[:4] == _ZSTD_MAGIC

    def test_event_not_found_falls_back_to_partial(self) -> None:
        original = _make_notification()
        # Don't register — eventstore returns None
        decoded = self.codec.decode(self.codec.encode(original))
        assert decoded.event.project_id == original.event.project_id
        assert decoded.event.event_id == original.event.event_id
        assert decoded.event.group_id == original.event.group_id
        assert decoded.event.datetime == original.event.datetime


class TestCompressedPickleCodec:
    codec: CompressedPickleCodec = CompressedPickleCodec()

    @pytest.fixture(autouse=True)
    def _mock_eventstore(self) -> Iterator[None]:
        self._events: dict[tuple[int, str], Event | GroupEvent] = {}

        def fake_get_event_by_id(project_id: int, event_id: str, **kwargs: object) -> Event | None:
            return self._events.get((project_id, event_id))

        with mock.patch(
            "sentry.eventstore.backend.get_event_by_id", side_effect=fake_get_event_by_id
        ):
            yield

    @pytest.fixture(autouse=True)
    def _enable_json_zstd(self) -> Iterator[None]:
        with override_options({"digests.encode-json-zstd": True}):
            yield

    def _register(self, notification: Notification) -> None:
        e = notification.event
        self._events[(e.project_id, e.event_id)] = e

    def test_round_trip(self) -> None:
        original = _make_notification()
        self._register(original)
        decoded = self.codec.decode(self.codec.encode(original))
        _assert_notifications_equal(decoded, original)

    def test_backward_compat_legacy_pickle_zlib(self) -> None:
        """Decoder can handle data written by the old pickle+zlib format."""
        original = _make_notification()
        legacy_bytes = zlib.compress(pickle.dumps(original, protocol=5))
        decoded = self.codec.decode(legacy_bytes)

        assert decoded.event.project_id == original.event.project_id
        assert decoded.event.event_id == original.event.event_id
        assert decoded.event.group_id == original.event.group_id
        assert list(decoded.rules) == list(original.rules)
        assert decoded.notification_uuid == original.notification_uuid

    def test_option_disabled_encodes_pickle(self) -> None:
        """When the option is off, encode produces pickle+zlib (the legacy format)."""
        with override_options({"digests.encode-json-zstd": False}):
            encoded = self.codec.encode(_make_notification())
        # zlib-compressed data starts with \x78
        assert encoded[0:1] == b"\x78"
        decoded = self.codec.decode(encoded)
        assert decoded.event.event_id == "abc123"

    def test_option_disabled_round_trip(self) -> None:
        """Full round-trip works with the option disabled (pickle path)."""
        original = _make_notification()
        with override_options({"digests.encode-json-zstd": False}):
            encoded = self.codec.encode(original)
            decoded = self.codec.decode(encoded)
        _assert_notifications_equal(decoded, original)

    def test_cross_format_decode(self) -> None:
        """Data written with option off can be read with option on, and vice versa."""
        original = _make_notification()
        self._register(original)

        # Write pickle, read with json-zstd enabled
        with override_options({"digests.encode-json-zstd": False}):
            pickle_encoded = self.codec.encode(original)
        decoded = self.codec.decode(pickle_encoded)
        assert decoded.event.event_id == original.event.event_id

        # Write json-zstd, read with option off (decoder doesn't check the option)
        zstd_encoded = self.codec.encode(original)
        with override_options({"digests.encode-json-zstd": False}):
            decoded = self.codec.decode(zstd_encoded)
        assert decoded.event.event_id == original.event.event_id

    def test_delegates_to_json_codec(self) -> None:
        original = _make_notification()
        self._register(original)
        encoded = self.codec.encode(original)
        assert encoded[:4] == _ZSTD_MAGIC
        json_codec = CompressedJsonCodec()
        decoded = json_codec.decode(encoded)
        assert decoded.event.event_id == original.event.event_id
