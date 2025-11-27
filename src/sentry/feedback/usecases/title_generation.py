from __future__ import annotations

import logging
from typing import TypedDict

from sentry.feedback.lib.seer_api import seer_summarization_connection_pool
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

SEER_TITLE_GENERATION_ENDPOINT_PATH = "/v1/automation/summarize/feedback/title"
SEER_TIMEOUT_S = 15
SEER_RETRIES = 0  # Do not retry since this is called in ingest.


class GenerateFeedbackTitleRequest(TypedDict):
    """Corresponds to GenerateFeedbackTitleRequest in Seer."""

    organization_id: int
    feedback_message: str


def truncate_feedback_title(title: str, max_words: int = 10) -> str:
    """
    Truncate and format a title for user feedback issues.

    Args:
        title: The title to truncate
        max_words: Maximum number of words to include from the title

    Returns:
        A truncated and formatted title string
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

    # Truncate if necessary (keeping some buffer for external system limits)
    if len(summary) > 185:  # Conservative limit
        summary = summary[:182] + "..."

    return summary


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
        response = make_signed_seer_api_request(
            connection_pool=seer_summarization_connection_pool,
            path=SEER_TITLE_GENERATION_ENDPOINT_PATH,
            body=json.dumps(seer_request).encode("utf-8"),
            timeout=SEER_TIMEOUT_S,
            retries=SEER_RETRIES,
        )
    except Exception:
        return None

    if response.status < 200 or response.status >= 300:
        logger.error(
            "Seer title generation endpoint failed",
            extra={"status_code": response.status, "response_data": response.data},
        )
        metrics.incr(
            "feedback.ai_title_generation.error",
            tags={"reason": "seer_response_failed"},
        )
        return None

    try:
        return response.json()["title"].strip() or None
    except Exception:
        return None


def get_feedback_title(feedback_message: str, organization_id: int, use_seer: bool) -> str:
    if use_seer:
        # Message is fallback if Seer fails.
        raw_title = (
            get_feedback_title_from_seer(feedback_message, organization_id) or feedback_message
        )
    else:
        raw_title = feedback_message
    return raw_title
