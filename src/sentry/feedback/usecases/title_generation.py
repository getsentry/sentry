from __future__ import annotations

import logging
from typing import TypedDict

import requests
from django.conf import settings

from sentry import features
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


class GenerateFeedbackTitleRequest(TypedDict):
    """Corresponds to GenerateFeedbackTitleRequest in Seer."""

    organization_id: int
    feedback_message: str


def get_ai_feedback_title(feedback_message: str, organization: Organization) -> str | None:
    """
    Generate an AI-powered title for user feedback using Seer.

    Args:
        feedback_message: The user's feedback message
        organization: The organization the feedback belongs to

    Returns:
        An AI-generated title string, or None if generation fails
    """
    if not features.has("organizations:gen-ai-features", organization):
        metrics.incr(
            "feedback.ai_title_generation.skipped",
            tags={"reason": "gen_ai_disabled", "organization_id": organization.id},
        )
        return None

    if organization.get_option("sentry:hide_ai_features"):
        metrics.incr(
            "feedback.ai_title_generation.skipped",
            tags={"reason": "ai_features_hidden", "organization_id": organization.id},
        )
        return None

    if not features.has("organizations:user-feedback-ai-titles", organization):
        metrics.incr(
            "feedback.ai_title_generation.skipped",
            tags={"reason": "feedback_ai_titles_disabled", "organization_id": organization.id},
        )
        return None

    seer_request = GenerateFeedbackTitleRequest(
        organization_id=organization.id,
        feedback_message=feedback_message,
    )

    try:
        response_data = json.loads(make_seer_request(seer_request).decode("utf-8"))
    except Exception:
        metrics.incr(
            "feedback.ai_title_generation.error",
            tags={"organization_id": organization.id},
        )
        return None

    try:
        title = response_data["title"]
    except KeyError:
        metrics.incr(
            "feedback.ai_title_generation.error",
            tags={"reason": "invalid_response", "organization_id": organization.id},
        )
        return None

    if not title or not isinstance(title, str) or not title.strip():
        metrics.incr(
            "feedback.ai_title_generation.error",
            tags={"reason": "invalid_response", "organization_id": organization.id},
        )
        return None

    metrics.incr(
        "feedback.ai_title_generation.success",
        tags={"organization_id": organization.id},
    )
    return title


def get_feedback_title(
    feedback_message: str, max_words: int = 10, organization: Organization | None = None
) -> str:
    """
    Generate a descriptive title for user feedback issues.
    Tries AI generation first if available, falls back to simple word-based title.
    Format: "User Feedback: [first few words of message] or AI-generated title

    Args:
        feedback_message: The user's feedback message
        max_words: Maximum number of words to include from the message (fallback only)
        organization: The organization the feedback belongs to (for AI features)

    Returns:
        A formatted title string
    """
    title = None
    if organization:
        title = get_ai_feedback_title(feedback_message, organization)
    if title is None:
        title = feedback_message
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


def make_seer_request(request: GenerateFeedbackTitleRequest) -> bytes:
    serialized_request = json.dumps(request)

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/title",
        data=serialized_request,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(serialized_request.encode()),
        },
    )

    if response.status_code != 200:
        logger.error(
            "Feedback: Failed to generate a title for a feedback",
            extra={
                "status_code": response.status_code,
                "response": response.text,
                "content": response.content,
            },
        )

    response.raise_for_status()

    return response.content
