from __future__ import annotations

import pickle
import zlib
from collections.abc import Iterator
from datetime import datetime, timezone

import pytest

from sentry.digests.codecs import CompressedPickleCodec
from sentry.digests.types import IdentifierKey, Notification
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


class TestCompressedPickleCodec:
    codec: CompressedPickleCodec = CompressedPickleCodec()

    @pytest.fixture(autouse=True)
    def _enable_json_zstd(self) -> Iterator[None]:
        with override_options({"digests.encode-json-zstd": True}):
            yield

    def test_round_trip(self) -> None:
        original = _make_notification()
        encoded = self.codec.encode(original)
        decoded = self.codec.decode(encoded)

        assert decoded.event.project_id == original.event.project_id
        assert decoded.event.event_id == original.event.event_id
        assert decoded.event.group_id == original.event.group_id
        assert decoded.event.datetime == original.event.datetime
        assert list(decoded.rules) == list(original.rules)
        assert decoded.notification_uuid == original.notification_uuid
        assert decoded.identifier_key == original.identifier_key

    def test_round_trip_workflow_identifier_key(self) -> None:
        original = _make_notification(identifier_key=IdentifierKey.WORKFLOW)
        decoded = self.codec.decode(self.codec.encode(original))
        assert decoded.identifier_key == IdentifierKey.WORKFLOW

    def test_round_trip_none_notification_uuid(self) -> None:
        original = _make_notification(notification_uuid=None)
        decoded = self.codec.decode(self.codec.encode(original))
        assert decoded.notification_uuid is None

    def test_round_trip_empty_rules(self) -> None:
        original = _make_notification(rules=[])
        decoded = self.codec.decode(self.codec.encode(original))
        assert list(decoded.rules) == []

    def test_decoded_event_datetime(self) -> None:
        ts = 1700000000.0
        original = _make_notification(timestamp=ts)
        decoded = self.codec.decode(self.codec.encode(original))
        expected = datetime.fromtimestamp(ts, tz=timezone.utc)
        assert decoded.event.datetime == expected

    def test_decoded_event_group_setter(self) -> None:
        """Verify the decoded Event supports the .group setter used by _bind_records."""
        decoded = self.codec.decode(self.codec.encode(_make_notification()))

        class FakeGroup:
            id: int = 99

        decoded.event.group = FakeGroup()
        assert decoded.event.group_id == 99

    def test_backward_compat_legacy_pickle_zlib(self) -> None:
        """New codec can decode data written by the old pickle+zlib codec."""
        original = _make_notification()
        legacy_bytes = zlib.compress(pickle.dumps(original, protocol=5))
        decoded = self.codec.decode(legacy_bytes)

        assert decoded.event.project_id == original.event.project_id
        assert decoded.event.event_id == original.event.event_id
        assert decoded.event.group_id == original.event.group_id
        assert list(decoded.rules) == list(original.rules)
        assert decoded.notification_uuid == original.notification_uuid

    def test_encoded_starts_with_zstd_magic(self) -> None:
        encoded = self.codec.encode(_make_notification())
        assert encoded[:4] == b"\x28\xb5\x2f\xfd"

    def test_option_disabled_encodes_pickle(self) -> None:
        """When the option is off, encode produces pickle+zlib (the legacy format)."""
        with override_options({"digests.encode-json-zstd": False}):
            encoded = self.codec.encode(_make_notification())
        # zlib-compressed data starts with \x78
        assert encoded[0:1] == b"\x78"
        # Decoder can still read it
        decoded = self.codec.decode(encoded)
        assert decoded.event.event_id == "abc123"

    def test_option_disabled_round_trip(self) -> None:
        """Full round-trip works with the option disabled (pickle path)."""
        original = _make_notification()
        with override_options({"digests.encode-json-zstd": False}):
            encoded = self.codec.encode(original)
            decoded = self.codec.decode(encoded)
        assert decoded.event.project_id == original.event.project_id
        assert decoded.event.event_id == original.event.event_id
        assert decoded.event.group_id == original.event.group_id
        assert list(decoded.rules) == list(original.rules)

    def test_cross_format_decode(self) -> None:
        """Data written with option off can be read with option on, and vice versa."""
        original = _make_notification()

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
