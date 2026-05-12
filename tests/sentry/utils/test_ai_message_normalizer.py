import json  # noqa: S003
from typing import Any

from sentry.utils.ai_message_normalizer import (
    extract_assistant_output,
    normalize_to_messages,
    stringify_message_content,
)


def json_string(value: Any) -> str:
    return json.dumps(value)


class TestNormalizeContentParts:
    def test_single_text_part(self) -> None:
        messages = json_string(
            [{"role": "user", "parts": [{"type": "text", "content": "Hello, world!"}]}]
        )
        assert normalize_to_messages(messages, "user") == [
            {"role": "user", "content": "Hello, world!"}
        ]

    def test_multiple_text_parts(self) -> None:
        messages = json_string(
            [
                {
                    "role": "user",
                    "parts": [
                        {"type": "text", "content": "First part."},
                        {"type": "text", "content": "Second part."},
                    ],
                }
            ]
        )
        assert normalize_to_messages(messages, "user") == [
            {"role": "user", "content": "First part.\nSecond part."}
        ]

    def test_mixed_part_types(self) -> None:
        messages = json_string(
            [
                {
                    "role": "user",
                    "parts": [
                        {"type": "text", "content": "User question"},
                        {"type": "tool_call", "id": "123", "name": "weather"},
                        {"type": "text", "content": "More text"},
                    ],
                }
            ]
        )
        assert normalize_to_messages(messages, "user") == [
            {"role": "user", "content": "User question\nMore text"}
        ]

    def test_empty_parts(self) -> None:
        messages = json_string([{"role": "user", "parts": []}])
        assert normalize_to_messages(messages, "user") is None

    def test_content_without_parts(self) -> None:
        messages = json_string([{"role": "user", "content": "old format"}])
        assert normalize_to_messages(messages, "user") == [
            {"role": "user", "content": "old format"}
        ]

    def test_parts_not_list(self) -> None:
        messages = json_string([{"role": "user", "parts": "invalid"}])
        assert normalize_to_messages(messages, "user") is None

    def test_empty_content(self) -> None:
        messages = json_string([{"role": "user", "parts": [{"type": "text", "content": ""}]}])
        assert normalize_to_messages(messages, "user") is None

    def test_missing_content(self) -> None:
        messages = json_string([{"role": "user", "parts": [{"type": "text"}]}])
        assert normalize_to_messages(messages, "user") is None


class TestNormalizeToMessages:
    def test_old_format_content(self) -> None:
        messages = json_string([{"role": "user", "content": "Hello"}])
        assert normalize_to_messages(messages, "user") == [{"role": "user", "content": "Hello"}]

    def test_new_format_parts(self) -> None:
        messages = json_string([{"role": "user", "parts": [{"type": "text", "content": "Hello"}]}])
        assert normalize_to_messages(messages, "user") == [{"role": "user", "content": "Hello"}]

    def test_prefers_parts_format_when_both_exist(self) -> None:
        messages = json_string(
            [
                {
                    "role": "user",
                    "content": "Old",
                    "parts": [{"type": "text", "content": "New"}],
                }
            ]
        )
        assert normalize_to_messages(messages, "user") == [{"role": "user", "content": "New"}]

    def test_finds_user_messages(self) -> None:
        messages = json_string(
            [
                {"role": "system", "content": "System"},
                {"role": "user", "content": "First"},
                {"role": "user", "content": "Second"},
            ]
        )
        assert normalize_to_messages(messages, "user") == [
            {"role": "system", "content": "System"},
            {"role": "user", "content": "First"},
            {"role": "user", "content": "Second"},
        ]

    def test_unwraps_messages_array(self) -> None:
        messages = json_string(
            {
                "system": "System",
                "messages": [{"role": "user", "content": "Hello"}],
            }
        )
        assert normalize_to_messages(messages, "user") == [
            {"role": "system", "content": "System"},
            {"role": "user", "content": "Hello"},
        ]

    def test_unwraps_messages_json_string(self) -> None:
        messages = json_string(
            {
                "system": "System",
                "messages": json_string([{"role": "user", "content": "Hello"}]),
            }
        )
        assert normalize_to_messages(messages, "user") == [
            {"role": "system", "content": "System"},
            {"role": "user", "content": "Hello"},
        ]

    def test_unwraps_system_prompt(self) -> None:
        messages = json_string({"system": "System", "prompt": "Question"})
        assert normalize_to_messages(messages, "user") == [
            {"role": "system", "content": "System"},
            {"role": "user", "content": "Question"},
        ]

    def test_returns_none_for_malformed_json(self) -> None:
        assert normalize_to_messages("[broken json", "user") is None

    def test_returns_none_for_none_input(self) -> None:
        assert normalize_to_messages(None, "user") is None

    def test_returns_none_for_empty_list(self) -> None:
        assert normalize_to_messages("[]", "user") is None

    def test_uses_plain_string_as_user_text(self) -> None:
        assert normalize_to_messages("Plain user input", "user") == [
            {"role": "user", "content": "Plain user input"}
        ]


class TestExtractAssistantOutput:
    def test_prefers_new_format_text_part(self) -> None:
        result = extract_assistant_output(
            json_string([{"role": "assistant", "parts": [{"type": "text", "content": "New"}]}]),
            "assistant",
        )
        assert result["response_text"] == "New"

    def test_prefers_new_format_content(self) -> None:
        result = extract_assistant_output(
            json_string([{"role": "assistant", "content": "New content"}]),
            "assistant",
        )
        assert result["response_text"] == "New content"

    def test_parses_json_encoded_content_string(self) -> None:
        result = extract_assistant_output(
            json_string([{"role": "assistant", "content": json_string("New content")}]),
            "assistant",
        )
        assert result["response_text"] == "New content"

    def test_parses_json_encoded_content_parts(self) -> None:
        result = extract_assistant_output(
            json_string(
                [
                    {
                        "role": "assistant",
                        "content": json_string([{"type": "text", "text": "New content"}]),
                    }
                ]
            ),
            "assistant",
        )
        assert result["response_text"] == "New content"

    def test_ignores_empty_string_content(self) -> None:
        result = extract_assistant_output(
            json_string(
                [
                    {"role": "assistant", "content": ""},
                    {"role": "assistant", "content": "New content"},
                ]
            ),
            "assistant",
        )
        assert result["response_text"] == "New content"

    def test_preserves_json_primitive_content_strings(self) -> None:
        numeric = extract_assistant_output(
            json_string([{"role": "assistant", "content": "42"}]), "assistant"
        )
        boolean = extract_assistant_output(
            json_string([{"role": "assistant", "content": "true"}]), "assistant"
        )
        null = extract_assistant_output(
            json_string([{"role": "assistant", "content": "null"}]), "assistant"
        )
        assert numeric["response_text"] == "42"
        assert boolean["response_text"] == "true"
        assert null["response_text"] == "null"

    def test_returns_none_when_empty(self) -> None:
        result = extract_assistant_output("", "assistant")
        assert result["response_text"] is None
        assert result["response_object"] is None
        assert result["tool_calls"] is None

    def test_joins_assistant_messages(self) -> None:
        result = extract_assistant_output(
            json_string(
                [
                    {"role": "assistant", "content": "First"},
                    {"role": "user", "content": "Question"},
                    {"role": "assistant", "content": "Last"},
                ]
            ),
            "assistant",
        )
        assert result["response_text"] == "First\nLast"

    def test_unwraps_messages_json_string(self) -> None:
        result = extract_assistant_output(
            json_string({"messages": json_string([{"role": "assistant", "content": "Wrapped"}])}),
            "assistant",
        )
        assert result["response_text"] == "Wrapped"

    def test_treats_default_role_only_messages_as_roleless(self) -> None:
        result = extract_assistant_output(
            json_string([{"content": "A"}, {"content": "B"}]),
            "assistant",
        )
        assert result["response_text"] == "B"

    def test_treats_declared_default_role_values_as_explicit_roles(self) -> None:
        result = extract_assistant_output(
            json_string(
                [
                    {"role": "assistant", "content": "A"},
                    {"role": "assistant", "content": "B"},
                ]
            ),
            "assistant",
        )
        assert result["response_text"] == "A\nB"

    def test_treats_declared_completion_roles_as_explicit_roles(self) -> None:
        result = extract_assistant_output(
            json_string(
                [
                    {"role": "assistant", "completion": "A"},
                    {"role": "assistant", "completion": "B"},
                ]
            ),
            "assistant",
        )
        assert result["response_text"] == "A\nB"

    def test_uses_plain_string_as_assistant_text(self) -> None:
        result = extract_assistant_output("Plain text response", "assistant")
        assert result["response_text"] == "Plain text response"

    def test_extracts_json_encoded_string(self) -> None:
        result = extract_assistant_output(json_string("Hello, world!"), "assistant")
        assert result["response_text"] == "Hello, world!"

    def test_returns_none_on_malformed_json(self) -> None:
        result = extract_assistant_output("[broken json", "assistant")
        assert result["response_text"] is None

    def test_extracts_single_object_content(self) -> None:
        result = extract_assistant_output(json_string({"content": "Object content"}), "assistant")
        assert result["response_text"] == "Object content"

    def test_extracts_single_object_completion(self) -> None:
        result = extract_assistant_output(
            json_string({"completion": "Completion text"}), "assistant"
        )
        assert result["response_text"] == "Completion text"


class TestStringifyMessageContent:
    def test_returns_strings_unchanged(self) -> None:
        assert stringify_message_content("Hello") == "Hello"
        assert stringify_message_content("") is None

    def test_json_encodes_structured_content(self) -> None:
        assert stringify_message_content({"question": "Weather?"}) == '{"question": "Weather?"}'
