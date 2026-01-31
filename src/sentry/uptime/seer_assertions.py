"""
Seer-powered assertion suggestions for uptime monitoring.

This module uses the Seer Explorer Client to generate assertion suggestions
based on HTTP response data from uptime preview checks.
"""

import base64
import logging
from typing import Any

from pydantic import BaseModel, Field

from sentry import features
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.utils import json

logger = logging.getLogger(__name__)


# Pydantic models for Seer artifact schema
class SuggestedAssertion(BaseModel):
    """A single assertion suggestion from Seer."""

    assertion_type: str = Field(
        description="Type of assertion: 'status_code', 'json_path', or 'header'"
    )
    comparison: str = Field(
        description="Comparison operator: 'equals', 'not_equal', 'less_than', 'greater_than'"
    )
    expected_value: str = Field(description="The expected value as a string")
    json_path: str | None = Field(
        default=None, description="JSONPath expression (for json_path assertions)"
    )
    header_name: str | None = Field(default=None, description="Header name (for header assertions)")
    confidence: float = Field(description="Confidence score from 0.0 to 1.0")
    explanation: str = Field(description="Why this assertion is useful")


class AssertionSuggestions(BaseModel):
    """Collection of assertion suggestions from Seer."""

    suggestions: list[SuggestedAssertion]


def parse_preview_response(preview_result: dict[str, Any]) -> dict[str, Any]:
    """
    Parse the preview check result into a format suitable for Seer.

    Args:
        preview_result: The JSON response from the uptime preview check endpoint

    Returns:
        Parsed response data with decoded body
    """
    check_result = preview_result.get("check_result", {})
    request_info = check_result.get("request_info", {})

    # Decode base64 response body if present
    response_body = None
    if request_info.get("response_body"):
        try:
            decoded = base64.b64decode(request_info["response_body"])
            # Try to parse as JSON
            try:
                response_body = json.loads(decoded)
            except json.JSONDecodeError:
                # Not JSON, use as string
                response_body = decoded.decode("utf-8", errors="replace")
        except Exception as e:
            logger.warning("Failed to decode response body: %s", e)

    return {
        "status_code": request_info.get("http_status_code"),
        "response_time_ms": check_result.get("duration_ms"),
        "headers": dict(request_info.get("response_headers", []) or []),
        "body": response_body,
    }


def build_assertion_prompt(response_data: dict[str, Any]) -> str:
    """
    Build the prompt for Seer to generate assertion suggestions.

    Args:
        response_data: Parsed HTTP response data

    Returns:
        Prompt string for Seer
    """
    return f"""Analyze this HTTP response from an uptime monitor test and suggest assertions
that would be useful for monitoring this endpoint's health.

HTTP Response Data:
- Status Code: {response_data.get('status_code')}
- Response Time: {response_data.get('response_time_ms')}ms
- Headers: {json.dumps(response_data.get('headers', {}), indent=2)}
- Body: {json.dumps(response_data.get('body'), indent=2) if response_data.get('body') else 'N/A'}

For each suggestion, provide:
- assertion_type: One of 'status_code', 'json_path', or 'header'
- comparison: One of 'equals', 'not_equal', 'less_than', 'greater_than'
- expected_value: The value to check against (as a string)
- json_path: For json_path assertions, the JSONPath expression (e.g., '$.status', '$.data.count')
- header_name: For header assertions, the header name to check
- confidence: How confident you are this is a good assertion (0.0-1.0)
- explanation: Brief explanation of why this assertion is useful

Guidelines:
1. Always suggest a status_code assertion (usually checking for 200 or 2xx range)
2. If the body is JSON, suggest json_path assertions for key fields that indicate health
3. Suggest header assertions only for headers that are meaningful for monitoring
4. Focus on assertions that would detect if the endpoint is unhealthy or behaving incorrectly
5. Prefer simple, robust assertions over complex ones
6. Suggest 3-5 practical assertions total

Return your suggestions as a structured list."""


def suggestion_to_assertion_json(suggestion: SuggestedAssertion) -> dict[str, Any]:
    """
    Convert a Seer suggestion to the uptime checker assertion JSON format.

    Args:
        suggestion: A SuggestedAssertion from Seer

    Returns:
        Assertion in the uptime checker JSON format
    """
    comparison_map = {
        "equals": "equals",
        "not_equal": "not_equal",
        "less_than": "less_than",
        "greater_than": "greater_than",
    }
    cmp = comparison_map.get(suggestion.comparison, "equals")

    if suggestion.assertion_type == "status_code":
        return {
            "op": "status_code_check",
            "value": int(suggestion.expected_value),
            "operator": {"cmp": cmp},
        }
    elif suggestion.assertion_type == "json_path":
        return {
            "op": "json_path",
            "value": suggestion.json_path or "$",
            "operator": {"cmp": cmp},
            "operand": {"jsonpath_op": "literal", "value": suggestion.expected_value},
        }
    elif suggestion.assertion_type == "header":
        return {
            "op": "header_check",
            "key_op": {"cmp": "equals"},
            "key_operand": {"header_op": "literal", "value": suggestion.header_name or ""},
            "value_op": {"cmp": cmp},
            "value_operand": {"header_op": "literal", "value": suggestion.expected_value},
        }
    else:
        # Default to status code check
        return {
            "op": "status_code_check",
            "value": 200,
            "operator": {"cmp": "equals"},
        }


def suggestions_to_combined_assertion(
    suggestions: list[SuggestedAssertion],
) -> dict[str, Any]:
    """
    Convert multiple suggestions into a combined assertion with AND logic.

    Args:
        suggestions: List of SuggestedAssertion objects

    Returns:
        Combined assertion JSON with all suggestions ANDed together
    """
    if not suggestions:
        return {"root": {"op": "status_code_check", "value": 200, "operator": {"cmp": "equals"}}}

    if len(suggestions) == 1:
        return {"root": suggestion_to_assertion_json(suggestions[0])}

    return {
        "root": {
            "op": "and",
            "children": [suggestion_to_assertion_json(s) for s in suggestions],
        }
    }


async def generate_assertion_suggestions(
    organization: Organization,
    user: User,
    preview_result: dict[str, Any],
) -> AssertionSuggestions | None:
    """
    Generate assertion suggestions using Seer based on preview check results.

    Args:
        organization: The organization making the request
        user: The user making the request
        preview_result: The JSON response from the uptime preview check

    Returns:
        AssertionSuggestions if successful, None if Seer is unavailable or fails
    """
    # Check feature flag
    if not features.has("organizations:seer-explorer", organization, actor=user):
        logger.info("Seer Explorer not enabled for organization %s", organization.slug)
        return None

    try:
        from sentry.seer.explorer.client import SeerExplorerClient

        # Parse the preview response
        response_data = parse_preview_response(preview_result)

        if not response_data.get("status_code"):
            logger.warning("No status code in preview result, skipping Seer suggestions")
            return None

        # Build the prompt
        prompt = build_assertion_prompt(response_data)

        # Create Seer client and start run
        client = SeerExplorerClient(organization, user)
        run_id = client.start_run(
            prompt,
            artifact_key="assertions",
            artifact_schema=AssertionSuggestions,
        )

        # Wait for result (with timeout)
        state = client.get_run(run_id, blocking=True)

        if state.status != "completed":
            logger.warning("Seer run did not complete successfully: %s", state.status)
            return None

        # Get the artifact
        suggestions = state.get_artifact("assertions", AssertionSuggestions)
        return suggestions

    except Exception as e:
        logger.exception("Error generating assertion suggestions: %s", e)
        return None
