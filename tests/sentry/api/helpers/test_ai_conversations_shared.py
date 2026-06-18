import json  # noqa: S003
from typing import Any

from sentry.api.helpers.ai_conversations_shared import (
    get_first_input_message,
    get_last_output,
)


def json_string(value: Any) -> str:
    return json.dumps(value)


class TestGetFirstInputMessage:
    def test_prefers_input_messages(self) -> None:
        row = {
            "gen_ai.input.messages": json_string(
                [{"role": "user", "parts": [{"type": "text", "content": "New"}]}]
            ),
            "gen_ai.request.messages": json_string([{"role": "user", "content": "Old"}]),
        }
        assert get_first_input_message(row) == "New"

    def test_falls_back_to_request_messages(self) -> None:
        row = {"gen_ai.request.messages": json_string([{"role": "user", "content": "Old"}])}
        assert get_first_input_message(row) == "Old"

    def test_returns_none_when_both_empty(self) -> None:
        row: dict[str, Any] = {}
        assert get_first_input_message(row) is None

    def test_skips_invalid_input_messages(self) -> None:
        row = {
            "gen_ai.input.messages": "[broken json",
            "gen_ai.request.messages": json_string([{"role": "user", "content": "Old"}]),
        }
        assert get_first_input_message(row) == "Old"

    def test_returns_filtered_for_input_messages(self) -> None:
        row = {"gen_ai.input.messages": "[Filtered]"}
        assert get_first_input_message(row) == "[Filtered]"

    def test_python_repr_single_quotes(self) -> None:
        row = {"gen_ai.input.messages": "[{'role': 'user', 'content': 'Hello'}]"}
        assert get_first_input_message(row) == "Hello"

    def test_python_repr_mixed_quotes(self) -> None:
        row = {"gen_ai.input.messages": """[{'role': 'user', 'content': "the user's message"}]"""}
        assert get_first_input_message(row) == "the user's message"

    def test_returns_filtered_for_request_messages(self) -> None:
        row = {"gen_ai.request.messages": "[Filtered]"}
        assert get_first_input_message(row) == "[Filtered]"


class TestGetLastOutput:
    def test_prefers_output_messages_text_part(self) -> None:
        row = {
            "gen_ai.output.messages": json_string(
                [{"role": "assistant", "parts": [{"type": "text", "content": "New"}]}]
            ),
            "gen_ai.response.text": "Old",
        }
        assert get_last_output(row) == "New"

    def test_prefers_output_messages_content(self) -> None:
        row = {
            "gen_ai.output.messages": json_string(
                [{"role": "assistant", "content": "New content"}]
            ),
            "gen_ai.response.text": "Old",
        }
        assert get_last_output(row) == "New content"

    def test_falls_back_to_response_text(self) -> None:
        row = {"gen_ai.response.text": "Old response"}
        assert get_last_output(row) == "Old response"

    def test_returns_none_when_empty(self) -> None:
        row: dict[str, Any] = {}
        assert get_last_output(row) is None

    def test_falls_back_on_invalid_output_messages(self) -> None:
        row = {
            "gen_ai.output.messages": "[broken json",
            "gen_ai.response.text": "Fallback",
        }
        assert get_last_output(row) == "Fallback"

    def test_returns_filtered(self) -> None:
        row = {"gen_ai.output.messages": "[Filtered]"}
        assert get_last_output(row) == "[Filtered]"

    def test_python_repr_output(self) -> None:
        row = {"gen_ai.output.messages": "[{'role': 'assistant', 'content': 'Hello!'}]"}
        assert get_last_output(row) == "Hello!"
