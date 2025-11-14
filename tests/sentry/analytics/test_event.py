from typing import int
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from sentry.analytics import Event, eventclass
from sentry.analytics.event import EventEnvelope
from sentry.testutils.cases import TestCase


@dataclass
class DummyType:
    key: str = "value"


@eventclass("example")
class ExampleEvent(Event):
    id: int
    map: dict | DummyType
    optional: bool | None = None


class EventTest(TestCase):
    @patch("sentry.analytics.event.uuid1")
    def test_simple(self, mock_uuid1: MagicMock) -> None:
        mock_uuid1.return_value = self.get_mock_uuid()

        result = EventEnvelope(
            event=ExampleEvent(
                id=1,
                map={"key": "value"},
                optional=False,
            ),
            datetime=datetime(2001, 4, 18, tzinfo=timezone.utc),
        )

        result.datetime = datetime(2001, 4, 18, tzinfo=timezone.utc)

        assert result.serialize() == {
            "data": {
                "id": 1,
                "map": {"key": "value"},
                "optional": False,
            },
            "type": "example",
            "timestamp": 987552000,
            "uuid": b"AAEC",
        }

    @patch("sentry.analytics.event.uuid1")
    def test_simple_from_instance(self, mock_uuid1: MagicMock) -> None:
        mock_uuid1.return_value = self.get_mock_uuid()

        result = EventEnvelope(
            ExampleEvent.from_instance(
                None,
                id=1,
                map={"key": "value"},
                optional=False,
            )
        )
        result.datetime = datetime(2001, 4, 18, tzinfo=timezone.utc)

        assert result.serialize() == {
            "data": {
                "id": 1,
                "map": {"key": "value"},
                "optional": False,
            },
            "type": "example",
            "timestamp": 987552000,
            "uuid": b"AAEC",
        }

    def test_optional_is_optional(self) -> None:
        result = ExampleEvent(id=1, map={"key": "value"})
        assert result.serialize() == {"id": 1, "map": {"key": "value"}, "optional": None}

    def test_required_cannot_be_none(self) -> None:
        with pytest.raises(TypeError):
            ExampleEvent(map={"key": None})  # type: ignore[call-arg]

    def test_map_with_instance(self) -> None:
        result = ExampleEvent(id=1, map=DummyType())
        assert result.serialize()["map"] == {"key": "value"}

    def test_new_fields_without_eventclass(self) -> None:
        class ExampleEventWithoutEventclass(ExampleEvent):
            new_field: str = "test"

        with pytest.raises(TypeError):
            with self.assertLogs("sentry.analytics.event", logging.WARNING) as cm:
                ExampleEventWithoutEventclass(id="1", map={"key": "value"}, new_field="test")  # type: ignore[arg-type,call-arg]

        assert "Event class with new fields must use @eventclass decorator" in cm.records[0].msg

    def test_no_new_fields_without_eventclass(self) -> None:
        class ExampleEventWithoutEventclass(ExampleEvent):
            pass

        with self.assertNoLogs("sentry.analytics.event"):
            ExampleEventWithoutEventclass(id="1", map={"key": "value"})  # type: ignore[arg-type]
