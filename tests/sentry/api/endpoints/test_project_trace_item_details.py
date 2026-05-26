import pytest

from sentry.api.endpoints.project_trace_item_details import convert_rpc_attribute_to_json
from sentry.search.eap.types import SupportedTraceItemType


def test_convert_rpc_attribute_to_json_serializes_known_string_array_without_array_flag() -> None:
    result = convert_rpc_attribute_to_json(
        [
            {
                "name": "gen_ai.output.messages",
                "value": {"valArray": {"values": [{"valStr": "assistant output"}]}},
            }
        ],
        SupportedTraceItemType.SPANS,
        use_sentry_conventions=True,
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
        use_sentry_conventions=True,
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
        use_sentry_conventions=True,
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
    """When use_sentry_conventions is off, replacement attributes should only be
    hidden if a deprecated source attribute is also present in the response."""

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
            use_sentry_conventions=False,
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
            use_sentry_conventions=False,
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
            use_sentry_conventions=False,
        )

        assert len(result) == 1
        assert result[0]["name"] == "gen_ai.output.messages"
