from __future__ import annotations

import logging
from typing import TypedDict

import requests
from django.conf import settings

from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

SEER_GENERATE_TITLE_URL = f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/title"


class GenerateFeedbackTitleRequest(TypedDict):
    """Corresponds to GenerateFeedbackTitleRequest in Seer."""

    organization_id: int
    feedback_message: str


def format_feedback_title(title: str, max_words: int = 10) -> str:
    """
    Clean and format a title for user feedback issues.
    Format: "User Feedback: [first few words of title]"

    Args:
        title: The title to format
        max_words: Maximum number of words to include from the title

    Returns:
        A formatted title string
    """
    stripped_message = title.strip()

    # Clean and split the message into words
    words = stripped_message.split()

    if len(words) <= max_words:
        summary = stripped_message
    else:
        summary = " ".join(words[:max_words])
        if len(summary) < len(stripped_message):
            summary += "..."

    title = f"User Feedback: {summary}"

    # Truncate if necessary (keeping some buffer for external system limits)
    if len(title) > 200:  # Conservative limit
        title = title[:197] + "..."

    return title


@metrics.wraps("feedback.ai_title_generation")
def get_feedback_title_from_seer(feedback_message: str, organization_id: int) -> str | None:
    """
    Generate an AI-powered title for user feedback using Seer, or None if generation fails.

    Args:
        feedback_message: The user's feedback message
        organization_id: The ID of the organization
        max_words: Maximum number of words to include from the generated title

    Returns:
        A title string or None if generation fails
    """
    seer_request = GenerateFeedbackTitleRequest(
        feedback_message=feedback_message,
        organization_id=organization_id,
    )

    try:
        response_data = json.loads(make_seer_request(seer_request).decode("utf-8"))
    except Exception:
        logger.exception("Seer failed to generate a title for user feedback")
        metrics.incr(
            "feedback.ai_title_generation.error",
            tags={"reason": "seer_response_failed"},
        )
        return None

    try:
        title = response_data["title"]
    except KeyError:
        logger.exception("Seer returned invalid response for user feedback title")
        metrics.incr(
            "feedback.ai_title_generation.error",
            tags={"reason": "invalid_response"},
        )
        return None

    if not title or not isinstance(title, str) or not title.strip():
        metrics.incr(
            "feedback.ai_title_generation.error",
            tags={"reason": "invalid_response"},
        )
        return None

    return title


def make_seer_request(request: GenerateFeedbackTitleRequest) -> bytes:
    """Make a request to the Seer service for AI title generation."""
    serialized_request = json.dumps(request)

    response = requests.post(
        SEER_GENERATE_TITLE_URL,
        data=serialized_request,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(serialized_request.encode()),
        },
        timeout=getattr(settings, "SEER_DEFAULT_TIMEOUT", 5),
    )

    if response.status_code != 200:
        response.raise_for_status()

    return response.content


def get_feedback_title(feedback_message: str, organization_id: int, use_seer: bool) -> str:
    if use_seer:
        # Message is fallback if Seer fails.
        raw_title = (
            get_feedback_title_from_seer(feedback_message, organization_id) or feedback_message
        )
    else:
        raw_title = feedback_message

    return format_feedback_title(raw_title)
