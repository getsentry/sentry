import pytest

from sentry.api.endpoints.project_trace_item_details import (
    convert_rpc_attribute_to_json,
    serialize_links,
    serialize_meta,
)
from sentry.search.eap import constants
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
    from all response surfaces unless the caller is internal (superuser/staff)."""

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

    def test_serialize_meta_hides_internal_convention_attributes(self) -> None:
        attributes = [
            self.INTERNAL_ATTR,
            self.PUBLIC_ATTR,
            {
                "name": f"{constants.META_ATTRIBUTE_PREFIX}.sentry.dsc.environment",
                "value": {"valStr": '{"err": ["some error"]}'},
            },
            {
                "name": f"{constants.META_ATTRIBUTE_PREFIX}.sentry.op",
                "value": {"valStr": '{"err": ["another error"]}'},
            },
        ]

        result = serialize_meta(attributes, SupportedTraceItemType.SPANS)

        assert "sentry.dsc.environment" not in result
        assert "dsc.environment" not in result
        assert any("op" in key for key in result)

    def test_serialize_meta_shows_internal_convention_when_include_internal(self) -> None:
        attributes = [
            self.INTERNAL_ATTR,
            {
                "name": f"{constants.META_ATTRIBUTE_PREFIX}.sentry.dsc.environment",
                "value": {"valStr": '{"err": ["some error"]}'},
            },
        ]

        result = serialize_meta(attributes, SupportedTraceItemType.SPANS, include_internal=True)

        assert any("dsc.environment" in key for key in result)

    def test_serialize_links_hides_internal_convention_link_attributes(self) -> None:
        attributes = [
            {
                "name": "sentry.links",
                "value": {
                    "valStr": json.dumps(
                        [
                            {
                                "span_id": "abc123",
                                "trace_id": "def456",
                                "attributes": {
                                    "sentry.dsc.environment": "production",
                                    "visible.attr": "value",
                                },
                            }
                        ]
                    )
                },
            }
        ]

        result = serialize_links(attributes, SupportedTraceItemType.SPANS)

        assert result is not None
        link_attr_names = [a["name"] for a in result[0].get("attributes", [])]
        assert "sentry.dsc.environment" not in link_attr_names
        assert "visible.attr" in link_attr_names

    def test_serialize_links_shows_internal_attrs_when_include_internal(self) -> None:
        attributes = [
            {
                "name": "sentry.links",
                "value": {
                    "valStr": json.dumps(
                        [
                            {
                                "span_id": "abc123",
                                "trace_id": "def456",
                                "attributes": {
                                    "sentry.dsc.environment": "production",
                                    "visible.attr": "value",
                                },
                            }
                        ]
                    )
                },
            }
        ]

        result = serialize_links(attributes, SupportedTraceItemType.SPANS, include_internal=True)

        assert result is not None
        link_attr_names = [a["name"] for a in result[0].get("attributes", [])]
        assert "sentry.dsc.environment" in link_attr_names
        assert "visible.attr" in link_attr_names
