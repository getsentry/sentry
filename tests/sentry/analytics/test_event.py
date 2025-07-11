from dataclasses import dataclass
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from sentry.analytics import Event, eventclass
from sentry.analytics.attribute import Attribute
from sentry.testutils.cases import TestCase


@dataclass
class DummyType:
    key: str = "value"


@eventclass("example")
class ExampleEvent(Event):
    id: int
    map: dict | DummyType
    optional: bool | None = None


class ExampleEventOldStyle(Event):
    type = "example-old-style"
    attributes = [
        Attribute("id", int),
        Attribute("map", dict),
        Attribute("optional", bool),
    ]


class EventTest(TestCase):
    @patch("sentry.analytics.event.uuid1")
    def test_simple(self, mock_uuid1):
        mock_uuid1.return_value = self.get_mock_uuid()

        result = ExampleEvent(
            id="1",  # type: ignore[arg-type]
            map={"key": "value"},
            optional=False,
        )
        result.datetime_ = datetime(2001, 4, 18, tzinfo=timezone.utc)

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

    def test_equality_no_uuid_mock(self):
        a = ExampleEvent(
            id="1",  # type: ignore[arg-type]
            map={"key": "value"},
            optional=False,
        )
        a.datetime_ = datetime(2001, 4, 18, tzinfo=timezone.utc)
        b = ExampleEvent(
            id="1",  # type: ignore[arg-type]
            map={"key": "value"},
            optional=False,
        )
        b.datetime_ = datetime(2001, 4, 18, tzinfo=timezone.utc)
        assert a == b

    @patch("sentry.analytics.event.uuid1")
    def test_simple_from_instance(self, mock_uuid1):
        mock_uuid1.return_value = self.get_mock_uuid()

        result = ExampleEvent.from_instance(
            None,
            id="1",
            map={"key": "value"},
            optional=False,
        )
        result.datetime_ = datetime(2001, 4, 18, tzinfo=timezone.utc)

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
    def test_simple_old_style(self, mock_uuid1):
        mock_uuid1.return_value = self.get_mock_uuid()

        result = ExampleEventOldStyle.from_instance(
            None,
            id="1",
            map={"key": "value"},
            optional=False,
        )
        result.datetime_ = datetime(2001, 4, 18, tzinfo=timezone.utc)

        assert result.serialize() == {
            "data": {
                "id": 1,
                "map": {"key": "value"},
                "optional": False,
            },
            "type": "example-old-style",
            "timestamp": 987552000,
            "uuid": b"AAEC",
        }

    def test_optional_is_optional(self):
        result = ExampleEvent(id="1", map={"key": "value"})  # type: ignore[arg-type]
        assert result.serialize()["data"] == {"id": 1, "map": {"key": "value"}, "optional": None}

    def test_required_cannot_be_none(self):
        with pytest.raises(TypeError):
            ExampleEvent(map={"key": None})  # type: ignore[call-arg]

    def test_invalid_map(self):
        with pytest.raises(ValueError):
            ExampleEvent(id="1", map="foo")  # type: ignore[arg-type]

    def test_map_with_instance(self):
        result = ExampleEvent(id="1", map=DummyType())  # type: ignore[arg-type]
        assert result.serialize()["data"]["map"] == {"key": "value"}
