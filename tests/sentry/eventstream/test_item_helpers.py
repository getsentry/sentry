import uuid
from datetime import datetime, timezone
from typing import Any

from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, ArrayValue

from sentry.db.models import NodeData
from sentry.eventstream.item_helpers import (
    _encode_value,
    _extract_exception,
    _extract_fingerprint,
    _extract_from_event,
    _extract_from_sdk,
    _extract_from_user,
    _extract_hashes,
    _extract_http,
    _extract_metadata,
    _extract_modules,
    _extract_tags_and_contexts,
    _extract_time_data,
    _flatten_attrs,
)
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.monitors.grouptype import MonitorIncidentType
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

    def test_encode_value(self) -> None:
        assert _encode_value("a") == AnyValue(string_value="a")
        assert _encode_value(True) == AnyValue(bool_value=True)
        assert _encode_value(1) == AnyValue(int_value=1)
        assert _encode_value(3.14) == AnyValue(double_value=3.14)
        assert _encode_value((1, "a")) == AnyValue(
            array_value=ArrayValue(values=[AnyValue(int_value=1), AnyValue(string_value="a")])
        )
        assert _encode_value([1, "a"]) == AnyValue(
            array_value=ArrayValue(values=[AnyValue(int_value=1), AnyValue(string_value="a")])
        )

    def test_encode_value_with_long_int(self) -> None:
        very_big_int = 2**70  # Should trigger ~2**63
        assert _encode_value(very_big_int) == AnyValue(string_value=str(very_big_int))

    def test_flatten_attrs(self) -> None:
        data = {
            "str": "s",
            "int": 1,
            "dict": {
                "a": "b",
                "x": 0,
            },
        }

        expected = {
            "p.str": "s",
            "p.int": 1,
            "p.dict.a": "b",
            "p.dict.x": 0,
        }

        assert _flatten_attrs("p", data) == expected

    def test_extract_from_event_without_issue_occurrence(
        self,
    ) -> None:
        event_data: dict[str, Any] = {}
        event = self.create_group_event(event_data)

        out = _extract_from_event(event)
        assert len(out) == 2
        assert out["group_id"] == event.group_id
        assert out["group_first_seen"] == event.group.first_seen.timestamp()
        assert "issue_occurrence_id" not in out
        assert "group_type_id" not in out

    def test_extract_from_event_with_issue_occurrence(self) -> None:
        event_data: dict[str, Any] = {}
        event = self.create_group_event(event_data)

        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=self.project.id,
            event_id=event.event_id,
            fingerprint=["some-fingerprint"],
            issue_title="something bad happened",
            subtitle="it was bad",
            resource_id=None,
            evidence_data={},
            evidence_display=[],
            type=MonitorIncidentType,
            detection_time=datetime.now(tz=timezone.utc),
            level="error",
            culprit=None,
        )
        event._occurrence = occurrence

        out = _extract_from_event(event)
        assert len(out) == 4
        assert out["group_id"] == event.group_id
        assert out["group_first_seen"] == event.group.first_seen.timestamp()
        assert out["issue_occurrence_id"] == occurrence.id
        assert out["group_type_id"] == MonitorIncidentType.type_id

    def test_extract_tags_and_contexts(
        self,
    ) -> None:
        # Test no promotion
        event_data = {
            "release": "r",
            "environment": "e",
            "dist": "d",
            "contexts": {"abc": 0, "xyz": 1, "sub": {"abcxyz": 2}},
        }
        out = _extract_tags_and_contexts(event_data)
        assert len(out) == 7
        assert out == {
            "attr_keys": ["attr[abc]", "attr[sub.abcxyz]", "attr[xyz]"],
            "release": "r",
            "environment": "e",
            "dist": "d",
            "attr[abc]": 0,
            "attr[xyz]": 1,
            "attr[sub.abcxyz]": 2,
        }

        # Test promotion
        event_data = {
            "release": "old_r",
            "environment": "old_e",
            "dist": "old_d",
            "contexts": {"sentry:release": "new_r", "environment": "new_e", "sentry:dist": "new_d"},
        }
        out = _extract_tags_and_contexts(event_data)
        assert out["release"] == "new_r"
        assert out["environment"] == "new_e"
        assert out["dist"] == "new_d"

    def test_extract_from_user(self) -> None:
        # Test IPv4
        event_data = {
            "user": {"email": "e", "user_id": "i", "username": "n", "ip_address": "1.2.3.4"}
        }
        out = _extract_from_user(event_data)
        assert out == {
            "ip_address_v4": "1.2.3.4",
            "user_email": "e",
            "user_id": "i",
            "user_name": "n",
        }

        # Test IPv6
        event_data = {
            "user": {"email": "e", "user_id": "i", "username": "n", "ip_address": "1:2:3:4::"}
        }
        out = _extract_from_user(event_data)
        assert out == {
            "ip_address_v6": "1:2:3:4::",
            "user_email": "e",
            "user_id": "i",
            "user_name": "n",
        }

        # Test invalid IP
        event_data = {
            "user": {"email": "e", "user_id": "i", "username": "n", "ip_address": "<REDACTED>"}
        }
        out = _extract_from_user(event_data)
        assert out == {
            "user_email": "e",
            "user_id": "i",
            "user_name": "n",
        }

    def test_extract_from_sdk(self) -> None:
        event_data = {"sdk": {"name": "n", "version": "v", "integrations": ["i"]}}
        out = _extract_from_sdk(event_data)
        assert out == {"sdk_name": "n", "sdk_version": "v", "sdk_integrations": ["i"]}

    def test_extract_time_data(self) -> None:
        event_data = {"timestamp": 123456}
        out = _extract_time_data(event_data)
        assert out == {"timestamp_ms": 123456000}

    def test_extract_hashes(
        self,
    ) -> None:
        event_data = {"hashes": ["deadbeef", "13371337"]}
        out = _extract_hashes(event_data)
        assert out == {"primary_hash": "deadbeef"}

    def test_extract_fingerprint(
        self,
    ) -> None:
        event_data = {"fingerprint": "{{cool}}", "grouping_config": {"a": 0, "b": 1}}
        out = _extract_fingerprint(event_data)
        assert out == {"fingerprint": "{{cool}}", "grouping_config.a": 0, "grouping_config.b": 1}

    def test_extract_metadata(
        self,
    ) -> None:
        event_data = {"metadata": {"a": 0, "b": 1}}
        out = _extract_metadata(event_data)
        assert out == {"metadata.a": 0, "metadata.b": 1}

    def test_extract_http(
        self,
    ) -> None:
        event_data = {
            "request": {
                "url": "sentry.io",
                "method": "GET",
                "headers": [["name", "val"], ["Referrer", "bestswetoolsofalltime.com"]],
            }
        }
        out = _extract_http(event_data)
        assert out == {
            "http_url": "sentry.io",
            "http_method": "GET",
            "http_referrer": "bestswetoolsofalltime.com",
        }

    def test_extract_modules(
        self,
    ) -> None:
        event_data = {"modules": {"foo": "1.2", "bar": "2.3"}}
        out = _extract_modules(event_data)
        assert out == {"modules.foo": "1.2", "modules.bar": "2.3"}

    def test_extract_exception(
        self,
    ) -> None:
        event_data = {
            "exception": {
                "values": [
                    {
                        "type": "t0",
                        "value": "v0",
                        "mechanism": {
                            "type": "mt0",
                            "handled": "mh0",
                        },
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "fa00",
                                    "filename": "ff00",
                                    "package": "fp00",
                                    "module": "fm00",
                                    "function": "fu00",
                                    "in_app": True,
                                    "colno": 0,
                                    "lineno": 0,
                                },
                                {
                                    "abs_path": "fa01",
                                    "filename": "ff01",
                                    "package": "fp01",
                                    "module": "fm01",
                                    "function": "fu01",
                                    "in_app": True,
                                    "colno": 1,
                                    "lineno": 1,
                                },
                            ],
                        },
                    },
                    {
                        "type": "t1",
                        "value": "v1",
                        "mechanism": {
                            "type": "mt1",
                            "handled": "mh1",
                        },
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "fa10",
                                    "filename": "ff10",
                                    "package": "fp10",
                                    "module": "fm10",
                                    "function": "fu10",
                                    "in_app": False,
                                    "colno": 2,
                                    "lineno": 2,
                                },
                                {
                                    "abs_path": "fa11",
                                    "filename": "ff11",
                                    "package": "fp11",
                                    "module": "fm11",
                                    "function": "fu11",
                                    "in_app": False,
                                    "colno": 3,
                                    "lineno": 3,
                                },
                            ],
                        },
                    },
                ]
            }
        }
        out = _extract_exception(event_data)

        assert out == {
            "exception_count": 2,
            "stack_types": ["t0", "t1"],
            "stack_values": ["v0", "v1"],
            "stack_mechanism_types": ["mt0", "mt1"],
            "stack_mechanism_handled": ["mh0", "mh1"],
            "frame_abs_paths": ["fa00", "fa01", "fa10", "fa11"],
            "frame_filenames": ["ff00", "ff01", "ff10", "ff11"],
            "frame_packages": ["fp00", "fp01", "fp10", "fp11"],
            "frame_modules": ["fm00", "fm01", "fm10", "fm11"],
            "frame_functions": ["fu00", "fu01", "fu10", "fu11"],
            "frame_in_app": [True, True, False, False],
            "frame_colnos": [0, 1, 2, 3],
            "frame_linenos": [0, 1, 2, 3],
            "frame_stack_levels": [0, 0, 1, 1],
        }
