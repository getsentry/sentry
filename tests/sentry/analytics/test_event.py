from dataclasses import dataclass
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from sentry.analytics import Event, eventclass
from sentry.analytics.attribute import Attribute
from sentry.analytics.event import EventEnvelope
from sentry.analytics.events.sentry_app_schema_validation_error import (
    SentryAppSchemaValidationError,
)
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
    def test_simple(self, mock_uuid1: MagicMock) -> None:
        mock_uuid1.return_value = self.get_mock_uuid()

        result = EventEnvelope(
            event=ExampleEvent(
                id="1",  # type: ignore[arg-type]
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
                id="1",
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

    @patch("sentry.analytics.event.uuid1")
    def test_simple_old_style(self, mock_uuid1: MagicMock) -> None:
        mock_uuid1.return_value = self.get_mock_uuid()

        result = EventEnvelope(
            ExampleEventOldStyle.from_instance(
                None,
                id="1",
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
            "type": "example-old-style",
            "timestamp": 987552000,
            "uuid": b"AAEC",
        }

    def test_optional_is_optional(self) -> None:
        result = ExampleEvent(id="1", map={"key": "value"})  # type: ignore[arg-type]
        assert result.serialize() == {"id": 1, "map": {"key": "value"}, "optional": None}

    def test_required_cannot_be_none(self) -> None:
        with pytest.raises(TypeError):
            ExampleEvent(map={"key": None})  # type: ignore[call-arg]

    def test_invalid_map(self) -> None:
        with pytest.raises(ValueError):
            ExampleEvent(id="1", map="foo")  # type: ignore[arg-type]

    def test_map_with_instance(self) -> None:
        result = ExampleEvent(id="1", map=DummyType())  # type: ignore[arg-type]
        assert result.serialize()["map"] == {"key": "value"}

    def test_sentry_app_schema_validation_error_serialization(self) -> None:
        event = SentryAppSchemaValidationError(
            app_schema='{"name": "test-app", "version": "1.0"}',
            user_id=12345,
            sentry_app_id=67890,
            sentry_app_name="Test App",
            organization_id=54321,
            error_message="Invalid schema format",
        )

        serialized = event.serialize()

        assert serialized == {
            "schema": '{"name": "test-app", "version": "1.0"}',
            "user_id": 12345,
            "sentry_app_id": 67890,
            "sentry_app_name": "Test App",
            "organization_id": 54321,
            "error_message": "Invalid schema format",
        }
        assert "app_schema" not in serialized

    def test_sentry_app_schema_validation_error_serialization_with_optional_fields(self) -> None:
        event = SentryAppSchemaValidationError(
            app_schema='{"name": "test-app"}',
            sentry_app_name="Test App",
            organization_id=54321,
            error_message="Invalid schema",
        )

        serialized = event.serialize()

        assert serialized == {
            "schema": '{"name": "test-app"}',
            "user_id": None,
            "sentry_app_id": None,
            "sentry_app_name": "Test App",
            "organization_id": 54321,
            "error_message": "Invalid schema",
        }
        assert "app_schema" not in serialized
