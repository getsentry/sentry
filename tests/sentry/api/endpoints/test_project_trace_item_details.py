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
