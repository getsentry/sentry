import logging

from sentry import features
from sentry.feedback.lib.seer_api import SpamDetectionRequest, make_spam_detection_request
from sentry.models.project import Project
from sentry.seer.seer_setup import has_seer_access
from sentry.utils import metrics

logger = logging.getLogger(__name__)

SEER_TIMEOUT_S = 15
SEER_RETRIES = 0


@metrics.wraps("feedback.spam_detection_seer")
def is_spam_seer(message: str, organization_id: int) -> bool | None:
    """
    Check if a message is spam using Seer.

    Returns True if the message is spam, False otherwise.
    Returns None if the request fails.
    """
    seer_request = SpamDetectionRequest(
        organization_id=organization_id,
        feedback_message=message,
    )

    try:
        response = make_spam_detection_request(
            seer_request,
            timeout=SEER_TIMEOUT_S,
            retries=SEER_RETRIES,
        )
    except Exception:
        logger.exception("Seer failed to check if message is spam")
        return None

    if response.status < 200 or response.status >= 300:
        logger.error(
            "Seer failed to check if message is spam",
            extra={"status_code": response.status, "response_data": response.data},
        )
        return None

    response_data = response.json()
    if (
        not isinstance(response_data, dict)
        or "is_spam" not in response_data
        or not isinstance(response_data["is_spam"], bool)
    ):
        logger.error(
            "Seer returned an invalid spam detection response",
            extra={"response_data": response.data},
        )
        return None
    return response_data["is_spam"]


def spam_detection_enabled(project: Project) -> bool:
    has_spam_enabled = features.has(
        "organizations:user-feedback-spam-ingest", project.organization
    ) and project.get_option("sentry:feedback_ai_spam_detection")

    has_ai_enabled = has_seer_access(project.organization)

    return has_spam_enabled and has_ai_enabled
