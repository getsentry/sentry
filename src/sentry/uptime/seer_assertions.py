"""
Seer-powered assertion suggestions for uptime monitoring.

This module uses Seer's LLM proxy to generate assertion suggestions
based on HTTP response data from uptime preview checks.
"""

import base64
import logging
from typing import Any

import orjson
import requests
from django.conf import settings
from pydantic import BaseModel, Field

from sentry import features
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.users.models.user import User
from sentry.utils import json

logger = logging.getLogger(__name__)

# JSON schema for structured LLM response
ASSERTION_SUGGESTIONS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "suggestions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "assertion_type": {
                        "type": "string",
                        "description": "Type of assertion: 'status_code', 'json_path', or 'header'",
                    },
                    "comparison": {
                        "type": "string",
                        "description": "Comparison operator: 'equals', 'not_equal', 'less_than', 'greater_than'",
                    },
                    "expected_value": {
                        "type": "string",
                        "description": "The expected value as a string",
                    },
                    "json_path": {
                        "type": "string",
                        "description": "JSONPath expression (for json_path assertions)",
                    },
                    "header_name": {
                        "type": "string",
                        "description": "Header name (for header assertions)",
                    },
                    "confidence": {
                        "type": "number",
                        "description": "Confidence score from 0.0 to 1.0",
                    },
                    "explanation": {
                        "type": "string",
                        "description": "Why this assertion is useful",
                    },
                },
                "required": [
                    "assertion_type",
                    "comparison",
                    "expected_value",
                    "confidence",
                    "explanation",
                ],
            },
        }
    },
    "required": ["suggestions"],
}

SYSTEM_PROMPT = """You are an expert at analyzing HTTP responses and suggesting monitoring assertions.
Given an HTTP response from an uptime check, suggest practical assertions that would help detect
when the endpoint is unhealthy or behaving incorrectly.

Guidelines:
1. Always suggest a status_code assertion (usually checking for 200 or 2xx range)
2. If the body is JSON, suggest json_path assertions for key fields that indicate health
3. Suggest header assertions only for headers that are meaningful for monitoring
4. Focus on assertions that would detect real problems, not minor variations
5. Prefer simple, robust assertions over complex ones
6. Suggest 3-5 practical assertions total"""


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
    return f"""Analyze this HTTP response and suggest monitoring assertions:

HTTP Response:
- Status Code: {response_data.get('status_code')}
- Response Time: {response_data.get('response_time_ms')}ms
- Headers: {json.dumps(response_data.get('headers', {}), indent=2)}
- Body: {json.dumps(response_data.get('body'), indent=2) if response_data.get('body') else 'N/A'}"""


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


def generate_assertion_suggestions(
    organization: Organization,
    user: User,
    preview_result: dict[str, Any],
) -> tuple[AssertionSuggestions | None, str | None]:
    """
    Generate assertion suggestions using Seer's LLM proxy based on preview check results.

    Args:
        organization: The organization making the request
        user: The user making the request
        preview_result: The JSON response from the uptime preview check

    Returns:
        Tuple of (AssertionSuggestions or None, debug_info string or None)
    """
    # Check feature flag
    if not features.has("organizations:gen-ai-features", organization, actor=user):
        logger.info("Gen AI features not enabled for organization %s", organization.slug)
        return None, "Feature flag 'gen-ai-features' not enabled for organization"

    # Parse the preview response
    response_data = parse_preview_response(preview_result)
    logger.info("Parsed response data: %s", response_data)

    if not response_data.get("status_code"):
        logger.warning("No status code in preview result, skipping Seer suggestions")
        return None, f"No status_code in parsed response. Got: {response_data}"

    # Build the prompt
    prompt = build_assertion_prompt(response_data)
    logger.info("Built prompt for Seer LLM proxy (length=%d)", len(prompt))

    # Call Seer's LLM proxy endpoint
    body = orjson.dumps(
        {
            "provider": "anthropic",
            "model": "sonnet",
            "referrer": "sentry.uptime.assertion-suggestions",
            "prompt": prompt,
            "system_prompt": SYSTEM_PROMPT,
            "temperature": 0.3,
            "max_tokens": 1500,
            "response_schema": ASSERTION_SUGGESTIONS_SCHEMA,
        }
    )

    try:
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v1/llm/generate",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
            timeout=30,
        )
        response.raise_for_status()
    except requests.RequestException as e:
        logger.exception("Failed to call Seer LLM proxy")
        return None, f"Seer LLM proxy request failed: {e}"

    try:
        data = response.json()
        content = data.get("content")
        if not content:
            logger.warning("Empty content from Seer LLM proxy")
            return None, "Seer LLM proxy returned empty content"

        # Parse the structured JSON response
        suggestions_data = json.loads(content)
        suggestions = AssertionSuggestions.model_validate(suggestions_data)

        logger.info("Got %d suggestions from Seer LLM proxy", len(suggestions.suggestions))
        return suggestions, None
    except (json.JSONDecodeError, ValueError) as e:
        logger.exception("Failed to parse Seer LLM proxy response")
        return None, f"Failed to parse Seer response: {e}"
