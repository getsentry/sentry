from typing import Any

from sentry_protos.snuba.v1.request_common_pb2 import TRACE_ITEM_TYPE_OCCURRENCE
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, ArrayValue, KeyValue, KeyValueList

from sentry.db.models import NodeData
from sentry.eventstream.item_helpers import encode_attributes, serialize_event_data_as_item
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.testutils.cases import TestCase


class ItemHelpersTest(TestCase):
    def create_group_event(self, event_data: dict[str, Any]) -> GroupEvent:
        group = self.create_group(project=self.project)
        node_id = Event.generate_node_id(self.project.id, "a" * 32)
        node_data = NodeData(node_id, data=event_data)
        group_event = GroupEvent(
            project_id=self.project.id,
            event_id="a" * 32,
            group=group,
            data=node_data,
        )
        return group_event

    def test_encode_attributes_basic(self) -> None:
        event_data = {
            "string_field": "test",
            "int_field": 123,
            "float_field": 45.67,
            "bool_field": True,
            "tags": [],
        }
        event = Event(
            event_id="a" * 32,
            data=event_data,
            project_id=self.project.id,
        )
        result = encode_attributes(event, event_data)

        assert result["string_field"] == AnyValue(string_value="test")
        assert result["int_field"] == AnyValue(int_value=123)
        assert result["float_field"] == AnyValue(double_value=45.67)
        assert result["bool_field"] == AnyValue(bool_value=True)

    def test_encode_attributes_with_ignore_fields(self) -> None:
        event_data = {
            "keep_field": "value1",
            "ignore_field": "value2",
            "another_keep": 42,
            "tags": [],
        }
        event = Event(
            event_id="a" * 32,
            data=event_data,
            project_id=self.project.id,
        )
        result = encode_attributes(event, event_data, ignore_fields={"ignore_field"})

        assert "keep_field" in result
        assert "another_keep" in result
        assert "ignore_field" not in result

    def test_encode_attributes_with_multiple_ignore_fields(self) -> None:
        event_data = {
            "field1": "value1",
            "field2": "value2",
            "field3": "value3",
            "tags": [],
        }
        event = Event(
            event_id="a" * 32,
            data=event_data,
            project_id=self.project.id,
        )
        result = encode_attributes(event, event_data, ignore_fields={"field1", "field3"})

        assert "field1" not in result
        assert "field2" in result
        assert "field3" not in result

    def test_encode_attributes_with_group_id(self) -> None:
        event_data = {"field": "value", "tags": []}

        event = self.create_group_event(event_data)
        result = encode_attributes(event, event_data)

        assert result["group_id"] == AnyValue(int_value=event.group.id)
        assert result["field"] == AnyValue(string_value="value")

    def test_encode_attributes_without_group_id(self) -> None:
        event_data = {"field": "value", "tags": []}

        event = Event(
            event_id="a" * 32,
            data=event_data,
            project_id=self.project.id,
        )

        result = encode_attributes(event, event_data)

        assert "group_id" not in result
        assert result["field"] == AnyValue(string_value="value")

    def test_encode_attributes_with_tags(self) -> None:
        event_data = {
            "field": "value",
            "tags": [
                ("environment", "production"),
                ("release", "1.0.0"),
                ("level", "error"),
            ],
        }

        event = Event(
            event_id="a" * 32,
            data=event_data,
            project_id=self.project.id,
        )

        result = encode_attributes(event, event_data)

        assert result["tags[environment]"] == AnyValue(string_value="production")
        assert result["tags[release]"] == AnyValue(string_value="1.0.0")
        assert result["tags[level]"] == AnyValue(string_value="error")
        assert result["tag_keys"] == AnyValue(
            array_value=ArrayValue(
                values=[
                    AnyValue(string_value="tags[environment]"),
                    AnyValue(string_value="tags[level]"),
                    AnyValue(string_value="tags[release]"),
                ]
            )
        )

    def test_encode_attributes_with_empty_tags(self) -> None:
        event_data = {"field": "value", "tags": []}

        event = Event(
            event_id="a" * 32,
            data=event_data,
            project_id=self.project.id,
        )

        result = encode_attributes(event, event_data)

        assert result["field"] == AnyValue(string_value="value")
        # No tags[] keys should be present
        assert not any(key.startswith("tags[") for key in result.keys())
        assert result["tag_keys"] == AnyValue(array_value=ArrayValue(values=[]))

    def test_encode_attributes_with_integer_tag_values(self) -> None:
        event_data = {
            "field": "value",
            "tags": [
                ("numeric_tag", "42"),
                ("string_tag", "value"),
            ],
        }

        event = self.create_group_event(event_data)
        result = encode_attributes(event, event_data)

        assert result["tags[numeric_tag]"] == AnyValue(string_value="42")
        assert result["tags[string_tag]"] == AnyValue(string_value="value")
        assert result["group_id"] == AnyValue(int_value=event.group.id)

    def test_encode_attributes_empty_event_data(self) -> None:
        event_data: dict[str, Any] = {"tags": []}

        event = Event(
            event_id="a" * 32,
            data=event_data,
            project_id=self.project.id,
        )
        result = encode_attributes(event, event_data)

        # "tags" field itself gets encoded as a non-scalar value in the loop
        # Then tags are processed separately, but empty list adds no tag attributes
        assert len(result) == 2
        assert result["tags"] == AnyValue(array_value=ArrayValue(values=[]))

    def test_encode_attributes_with_complex_types(self) -> None:
        event_data = {
            "list_field": [1, 2, 3],
            "dict_field": {"nested": "value"},
            "tags": [],
        }

        event = Event(
            event_id="a" * 32,
            data=event_data,
            project_id=self.project.id,
        )

        result = encode_attributes(event, event_data)

        assert result["list_field"] == AnyValue(
            array_value=ArrayValue(
                values=[
                    AnyValue(int_value=1),
                    AnyValue(int_value=2),
                    AnyValue(int_value=3),
                ]
            )
        )
        assert result["dict_field"] == AnyValue(
            kvlist_value=KeyValueList(
                values=[
                    KeyValue(key="nested", value=AnyValue(string_value="value")),
                ]
            )
        )

    def test_serialize_event_data_as_item_basic(self) -> None:
        project = self.create_project()

        event_data = {
            "event_id": "a" * 32,
            "timestamp": 1234567890,
            "contexts": {"trace": {"trace_id": "b" * 32}},
            "string_field": "test_value",
            "int_field": 42,
            "tags": [("environment", "production")],
        }

        event = self.create_group_event(event_data)
        result = serialize_event_data_as_item(event, event_data, project)

        assert result.item_id == ("a" * 32).encode("utf-8")
        assert result.item_type == TRACE_ITEM_TYPE_OCCURRENCE
        assert result.trace_id == "b" * 32
        assert result.timestamp.seconds == 1234567890
        assert result.organization_id == project.organization_id
        assert result.project_id == project.id
        assert result.retention_days == 90
        # Check that received field is not set (protobuf optional field)
        assert not result.HasField("received")

    def test_serialize_event_data_as_item_with_received(self) -> None:
        project = self.create_project()

        event_data = {
            "event_id": "c" * 32,
            "timestamp": 1234567890,
            "received": 1234567900,
            "contexts": {"trace": {"trace_id": "d" * 32}},
            "tags": [],
        }

        event = Event(
            event_id="c" * 32,
            data=event_data,
            project_id=project.id,
        )
        result = serialize_event_data_as_item(event, event_data, project)

        assert result.HasField("received")
        assert result.received.seconds == 1234567900

    def test_serialize_event_data_as_item_with_custom_retention_days(self) -> None:
        project = self.create_project()

        event_data = {
            "event_id": "e" * 32,
            "timestamp": 1234567890,
            "contexts": {"trace": {"trace_id": "f" * 32}},
            "retention_days": 30,
            "tags": [],
        }

        event = Event(
            event_id="e" * 32,
            data=event_data,
            project_id=project.id,
        )

        result = serialize_event_data_as_item(event, event_data, project)

        assert result.retention_days == 30

    def test_serialize_event_data_as_item_ignores_specified_fields(self) -> None:
        project = self.create_project()

        event_data = {
            "event_id": "g" * 32,
            "timestamp": 1234567890,
            "contexts": {"trace": {"trace_id": "h" * 32}},
            "other_field": "should_be_included",
            "tags": [("level", "info")],
            "empty": None,
        }

        event = self.create_group_event(event_data)
        result = serialize_event_data_as_item(event, event_data, project)

        # event_id, timestamp, and tags should be ignored in attributes
        assert "event_id" not in result.attributes
        assert "timestamp" not in result.attributes
        assert "tags" not in result.attributes
        assert "empty" not in result.attributes
        # other_field should be present
        assert result.attributes["other_field"] == AnyValue(string_value="should_be_included")
        # group_id should be added
        assert result.attributes["group_id"] == AnyValue(int_value=event.group.id)
        # tags should be encoded with tags[] prefix
        assert result.attributes["tags[level]"] == AnyValue(string_value="info")

    def test_serialize_event_data_as_item_with_multiple_attributes(self) -> None:
        project = self.create_project()

        event_data = {
            "event_id": "i" * 32,
            "timestamp": 1234567890,
            "contexts": {"trace": {"trace_id": "j" * 32}},
            "level": "error",
            "logger": "django",
            "server_name": "web-1",
            "release": "1.0.0",
            "environment": "production",
            "tags": [],
        }

        event = Event(
            event_id="i" * 32,
            data=event_data,
            project_id=project.id,
        )
        result = serialize_event_data_as_item(event, event_data, project)

        assert result.attributes["level"] == AnyValue(string_value="error")
        assert result.attributes["logger"] == AnyValue(string_value="django")
        assert result.attributes["server_name"] == AnyValue(string_value="web-1")
        assert result.attributes["release"] == AnyValue(string_value="1.0.0")
        assert result.attributes["environment"] == AnyValue(string_value="production")
