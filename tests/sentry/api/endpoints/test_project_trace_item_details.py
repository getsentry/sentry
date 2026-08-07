from datetime import UTC, datetime
from typing import Any

import pytest

from sentry.api.endpoints.project_trace_item_details import (
    convert_rpc_attribute_to_json,
    serialize_event,
)
from sentry.search.eap.types import SupportedTraceItemType
from sentry.utils import json


def test_convert_rpc_attribute_to_json_serializes_known_string_array_without_array_flag() -> None:
    result = convert_rpc_attribute_to_json(
        [
            {
                "name": "gen_ai.output.messages",
                "value": {"valArray": {"values": [{"valStr": "assistant output"}]}},
            }
        ],
        SupportedTraceItemType.SPANS,
    )

    assert result == [
        {
            "name": "gen_ai.output.messages",
            "type": "str",
            "value": '["assistant output"]',
        }
    ]


def test_convert_rpc_attribute_to_json_hides_unknown_array_without_array_flag() -> None:
    result = convert_rpc_attribute_to_json(
        [
            {
                "name": "custom.array",
                "value": {"valArray": {"values": [{"valStr": "custom value"}]}},
            }
        ],
        SupportedTraceItemType.SPANS,
    )

    assert result == []


def test_convert_rpc_attribute_to_json_hides_non_replacement_array_without_array_flag() -> None:
    result = convert_rpc_attribute_to_json(
        [
            {
                "name": "stack.filename",
                "value": {"valArray": {"values": [{"valStr": "sentry/web/urls.py"}]}},
            }
        ],
        SupportedTraceItemType.OCCURRENCES,
    )

    assert result == []


def test_convert_rpc_attribute_to_json_exposes_array_with_array_flag() -> None:
    result = convert_rpc_attribute_to_json(
        [
            {
                "name": "gen_ai.output.messages",
                "value": {"valArray": {"values": [{"valStr": "assistant output"}]}},
            }
        ],
        SupportedTraceItemType.SPANS,
        include_arrays=True,
    )

    assert result == [
        {
            "name": "gen_ai.output.messages",
            "type": "array",
            "value": ["assistant output"],
        }
    ]


class TestSerializeEvent:
    def _breadcrumb_attribute(self, values: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "name": "sentry.event.serialized_breadcrumbs",
            "value": {"valStr": json.dumps({"values": values})},
        }

    def test_returns_none_when_no_event_attributes(self) -> None:
        assert serialize_event([{"name": "sentry.op", "value": {"valStr": "http"}}]) is None

    def test_normalizes_numeric_breadcrumb_timestamp_to_datetime(self) -> None:
        # Relay serializes breadcrumb timestamps as epoch-seconds floats.
        result = serialize_event(
            [self._breadcrumb_attribute([{"type": "default", "timestamp": 1785955938.308}])]
        )

        assert result is not None
        crumb = result["breadcrumbs"]["values"][0]
        assert crumb["timestamp"] == datetime(2026, 8, 5, 18, 52, 18, 308000, tzinfo=UTC)

    def test_leaves_string_breadcrumb_timestamp_untouched(self) -> None:
        result = serialize_event(
            [
                self._breadcrumb_attribute(
                    [{"type": "default", "timestamp": "2026-08-05T18:52:18.308000Z"}]
                )
            ]
        )

        assert result is not None
        crumb = result["breadcrumbs"]["values"][0]
        assert crumb["timestamp"] == "2026-08-05T18:52:18.308000Z"

    def test_handles_breadcrumb_without_timestamp(self) -> None:
        result = serialize_event([self._breadcrumb_attribute([{"type": "default"}])])

        assert result is not None
        assert "timestamp" not in result["breadcrumbs"]["values"][0]

    def test_does_not_coerce_boolean_timestamp(self) -> None:
        # bool is a subclass of int; ensure we don't treat it as an epoch value.
        result = serialize_event(
            [self._breadcrumb_attribute([{"type": "default", "timestamp": True}])]
        )

        assert result is not None
        assert result["breadcrumbs"]["values"][0]["timestamp"] is True

    def test_leaves_out_of_range_timestamp_untouched(self) -> None:
        # A millisecond-scale epoch is out of datetime's range; degrade to the
        # raw value instead of 500ing the whole response.
        result = serialize_event(
            [self._breadcrumb_attribute([{"type": "default", "timestamp": 1785955938308.0}])]
        )

        assert result is not None
        assert result["breadcrumbs"]["values"][0]["timestamp"] == 1785955938308.0

    def test_passes_through_contexts_and_extra(self) -> None:
        result = serialize_event(
            [
                {
                    "name": "sentry.event.serialized_contexts",
                    "value": {
                        "valStr": json.dumps({"device": {"boot_time": "2018-02-08T12:52:12Z"}})
                    },
                },
                {
                    "name": "sentry.event.serialized_extra",
                    "value": {"valStr": json.dumps({"foo": "bar"})},
                },
            ]
        )

        assert result == {
            "contexts": {"device": {"boot_time": "2018-02-08T12:52:12Z"}},
            "extra": {"foo": "bar"},
        }


class TestReplacementAttributeFiltering:
    """Replacement attributes should only be hidden if a deprecated source
    attribute is also present in the response."""

    @pytest.mark.parametrize(
        "attr_name,attr_value",
        [
            ("gen_ai.usage.input_tokens", {"valInt": "42"}),
            ("gen_ai.input.messages", {"valStr": '["hello"]'}),
            ("gen_ai.output.messages", {"valStr": '["world"]'}),
        ],
    )
    def test_replacement_attribute_shown_when_no_deprecated_source(
        self, attr_name: str, attr_value: dict[str, str]
    ) -> None:
        result = convert_rpc_attribute_to_json(
            [{"name": attr_name, "value": attr_value}],
            SupportedTraceItemType.SPANS,
        )

        assert len(result) == 1
        assert result[0]["name"] == attr_name

    def test_replacement_attribute_hidden_when_deprecated_source_present(self) -> None:
        result = convert_rpc_attribute_to_json(
            [
                {"name": "gen_ai.usage.prompt_tokens", "value": {"valInt": "42"}},
                {"name": "gen_ai.usage.input_tokens", "value": {"valInt": "42"}},
            ],
            SupportedTraceItemType.SPANS,
        )

        names = [r["name"] for r in result]
        assert "gen_ai.usage.prompt_tokens" in names
        assert "gen_ai.usage.input_tokens" not in names

    def test_replacement_array_shown_when_no_deprecated_source(self) -> None:
        result = convert_rpc_attribute_to_json(
            [
                {
                    "name": "gen_ai.output.messages",
                    "value": {"valArray": {"values": [{"valStr": "output"}]}},
                }
            ],
            SupportedTraceItemType.SPANS,
        )

        assert len(result) == 1
        assert result[0]["name"] == "gen_ai.output.messages"


class TestInternalConventionVisibilityFiltering:
    """Attributes with visibility=internal in sentry-conventions must be hidden
    unless the caller is internal (superuser/staff)."""

    INTERNAL_ATTR = {
        "name": "sentry.dsc.environment",
        "value": {"valStr": "production"},
    }
    PUBLIC_ATTR = {
        "name": "sentry.op",
        "value": {"valStr": "http.client"},
    }

    def test_convert_rpc_hides_internal_convention_attributes(self) -> None:
        result = convert_rpc_attribute_to_json(
            [self.INTERNAL_ATTR, self.PUBLIC_ATTR],
            SupportedTraceItemType.SPANS,
        )

        names = [r["name"] for r in result]
        assert "sentry.dsc.environment" not in names
        assert "dsc.environment" not in names

    def test_convert_rpc_shows_internal_convention_attributes_when_include_internal(self) -> None:
        result = convert_rpc_attribute_to_json(
            [self.INTERNAL_ATTR, self.PUBLIC_ATTR],
            SupportedTraceItemType.SPANS,
            include_internal=True,
        )

        names = [r["name"] for r in result]
        assert any("dsc.environment" in n for n in names)
