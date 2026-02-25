import base64
from unittest.mock import patch

from sentry.testutils.cases import TestCase
from sentry.uptime.seer_assertions import (
    SuggestedAssertion,
    build_assertion_prompt,
    generate_assertion_suggestions,
    parse_preview_response,
    suggestion_to_assertion_json,
    suggestions_to_combined_assertion,
)


class ParsePreviewResponseTest(TestCase):
    def test_basic_json_body(self):
        body_bytes = b'{"status": "ok", "count": 42}'
        encoded = base64.b64encode(body_bytes).decode()

        preview_result = {
            "check_result": {
                "duration_ms": 150,
                "request_info": {
                    "http_status_code": 200,
                    "response_body": encoded,
                    "response_headers": [
                        ["content-type", "application/json"],
                    ],
                },
            }
        }

        result = parse_preview_response(preview_result)

        assert result["status_code"] == 200
        assert result["response_time_ms"] == 150
        assert result["headers"] == {"content-type": "application/json"}
        assert result["body"] == {"status": "ok", "count": 42}

    def test_non_json_body(self):
        body_bytes = b"<html>Hello</html>"
        encoded = base64.b64encode(body_bytes).decode()

        preview_result = {
            "check_result": {
                "duration_ms": 80,
                "request_info": {
                    "http_status_code": 200,
                    "response_body": encoded,
                    "response_headers": [],
                },
            }
        }

        result = parse_preview_response(preview_result)

        assert result["body"] == "<html>Hello</html>"

    def test_empty_body(self):
        preview_result = {
            "check_result": {
                "duration_ms": 100,
                "request_info": {
                    "http_status_code": 204,
                    "response_body": None,
                    "response_headers": [],
                },
            }
        }

        result = parse_preview_response(preview_result)

        assert result["body"] is None
        assert result["status_code"] == 204

    def test_empty_preview_result(self):
        result = parse_preview_response({})

        assert result["status_code"] is None
        assert result["body"] is None
        assert result["headers"] == {}


class BuildAssertionPromptTest(TestCase):
    def test_includes_response_data(self):
        response_data = {
            "status_code": 200,
            "response_time_ms": 150,
            "headers": {"content-type": "application/json"},
            "body": {"status": "ok"},
        }

        prompt = build_assertion_prompt(response_data)

        assert "200" in prompt
        assert "150" in prompt
        assert "content-type" in prompt
        assert "ok" in prompt


class SuggestionToAssertionJsonTest(TestCase):
    def test_status_code(self):
        suggestion = SuggestedAssertion(
            assertion_type="status_code",
            comparison="equals",
            expected_value="200",
            confidence=0.95,
            explanation="Status code should be 200",
        )

        result = suggestion_to_assertion_json(suggestion)

        assert result == {
            "op": "status_code_check",
            "value": 200,
            "operator": {"cmp": "equals"},
        }

    def test_json_path_equals(self):
        suggestion = SuggestedAssertion(
            assertion_type="json_path",
            comparison="equals",
            expected_value="ok",
            json_path="$.status",
            confidence=0.9,
            explanation="Status should be ok",
        )

        result = suggestion_to_assertion_json(suggestion)

        assert result == {
            "op": "json_path",
            "value": "$.status",
            "operator": {"cmp": "equals"},
            "operand": {"jsonpath_op": "literal", "value": "ok"},
        }

    def test_json_path_always(self):
        suggestion = SuggestedAssertion(
            assertion_type="json_path",
            comparison="always",
            expected_value="",
            json_path="$.data",
            confidence=0.8,
            explanation="Data should exist",
        )

        result = suggestion_to_assertion_json(suggestion)

        assert result == {
            "op": "json_path",
            "value": "$.data",
            "operator": {"cmp": "always"},
            "operand": {"jsonpath_op": "none"},
        }

    def test_header_equals(self):
        suggestion = SuggestedAssertion(
            assertion_type="header",
            comparison="equals",
            expected_value="application/json",
            header_name="content-type",
            confidence=0.85,
            explanation="Content type should be JSON",
        )

        result = suggestion_to_assertion_json(suggestion)

        assert result == {
            "op": "header_check",
            "key_op": {"cmp": "equals"},
            "key_operand": {"header_op": "literal", "value": "content-type"},
            "value_op": {"cmp": "equals"},
            "value_operand": {"header_op": "literal", "value": "application/json"},
        }

    def test_header_always(self):
        suggestion = SuggestedAssertion(
            assertion_type="header",
            comparison="always",
            expected_value="",
            header_name="x-request-id",
            confidence=0.7,
            explanation="Request ID header should exist",
        )

        result = suggestion_to_assertion_json(suggestion)

        assert result == {
            "op": "header_check",
            "key_op": {"cmp": "equals"},
            "key_operand": {"header_op": "literal", "value": "x-request-id"},
            "value_op": {"cmp": "always"},
            "value_operand": {"header_op": "none"},
        }

    def test_invalid_comparison_falls_back_to_equals(self):
        suggestion = SuggestedAssertion(
            assertion_type="status_code",
            comparison="invalid_op",
            expected_value="200",
            confidence=0.5,
            explanation="test",
        )

        result = suggestion_to_assertion_json(suggestion)

        assert result["operator"]["cmp"] == "equals"

    def test_unknown_type_falls_back_to_status_code(self):
        suggestion = SuggestedAssertion(
            assertion_type="unknown",
            comparison="equals",
            expected_value="200",
            confidence=0.5,
            explanation="test",
        )

        result = suggestion_to_assertion_json(suggestion)

        assert result == {
            "op": "status_code_check",
            "value": 200,
            "operator": {"cmp": "equals"},
        }


class SuggestionsToCombinedAssertionTest(TestCase):
    def test_empty_suggestions(self):
        result = suggestions_to_combined_assertion([])

        assert result == {
            "root": {"op": "status_code_check", "value": 200, "operator": {"cmp": "equals"}}
        }

    def test_single_suggestion(self):
        suggestion = SuggestedAssertion(
            assertion_type="status_code",
            comparison="equals",
            expected_value="200",
            confidence=0.95,
            explanation="test",
        )

        result = suggestions_to_combined_assertion([suggestion])

        assert result == {
            "root": {
                "op": "status_code_check",
                "value": 200,
                "operator": {"cmp": "equals"},
            }
        }

    def test_multiple_suggestions(self):
        suggestions = [
            SuggestedAssertion(
                assertion_type="status_code",
                comparison="equals",
                expected_value="200",
                confidence=0.95,
                explanation="test",
            ),
            SuggestedAssertion(
                assertion_type="json_path",
                comparison="equals",
                expected_value="ok",
                json_path="$.status",
                confidence=0.9,
                explanation="test",
            ),
        ]

        result = suggestions_to_combined_assertion(suggestions)

        assert result["root"]["op"] == "and"
        assert len(result["root"]["children"]) == 2
        assert result["root"]["children"][0]["op"] == "status_code_check"
        assert result["root"]["children"][1]["op"] == "json_path"


class GenerateAssertionSuggestionsTest(TestCase):
    def test_no_status_code(self):
        suggestions, debug = generate_assertion_suggestions(
            {"check_result": {"request_info": {}}},
        )

        assert suggestions is None
        assert debug is not None and "No status_code" in debug

    @patch("sentry.uptime.seer_assertions.make_signed_seer_api_request")
    def test_seer_request_failure(self, mock_request):
        from sentry.seer.models import SeerApiError

        mock_request.side_effect = SeerApiError("Connection failed", 500)

        preview_result = {
            "check_result": {
                "duration_ms": 100,
                "request_info": {
                    "http_status_code": 200,
                    "response_body": None,
                    "response_headers": [],
                },
            }
        }

        suggestions, debug = generate_assertion_suggestions(preview_result)

        assert suggestions is None
        assert debug is not None and "request failed" in debug

    @patch("sentry.uptime.seer_assertions.make_signed_seer_api_request")
    def test_successful_generation(self, mock_request):
        mock_request.return_value.status = 200
        mock_request.return_value.json.return_value = {
            "content": '{"suggestions": [{"assertion_type": "status_code", "comparison": "equals", "expected_value": "200", "confidence": 0.95, "explanation": "test"}]}'
        }

        preview_result = {
            "check_result": {
                "duration_ms": 100,
                "request_info": {
                    "http_status_code": 200,
                    "response_body": None,
                    "response_headers": [],
                },
            }
        }

        suggestions, debug = generate_assertion_suggestions(preview_result)

        assert suggestions is not None
        assert len(suggestions.suggestions) == 1
        assert suggestions.suggestions[0].assertion_type == "status_code"
        assert debug is None

    @patch("sentry.uptime.seer_assertions.make_signed_seer_api_request")
    def test_empty_seer_content(self, mock_request):
        mock_request.return_value.status = 200
        mock_request.return_value.json.return_value = {"content": ""}

        preview_result = {
            "check_result": {
                "duration_ms": 100,
                "request_info": {
                    "http_status_code": 200,
                    "response_body": None,
                    "response_headers": [],
                },
            }
        }

        suggestions, debug = generate_assertion_suggestions(preview_result)

        assert suggestions is None
        assert debug is not None and "empty content" in debug
