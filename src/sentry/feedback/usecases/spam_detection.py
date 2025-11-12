import logging

from sentry import features
from sentry.feedback.lib.seer_api import seer_summarization_connection_pool
from sentry.models.project import Project
from sentry.seer.seer_setup import has_seer_access
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

SEER_SPAM_DETECTION_ENDPOINT_PATH = "/v1/automation/summarize/feedback/spam-detection"
SEER_TIMEOUT_S = 15
SEER_RETRIES = 0


@metrics.wraps("feedback.spam_detection_seer")
def is_spam_seer(message: str, organization_id: int) -> bool | None:
    """
    Check if a message is spam using Seer.

    Returns True if the message is spam, False otherwise.
    Returns None if the request fails.
    """
    seer_request = {
        "organization_id": organization_id,
        "feedback_message": message,
    }

    try:
        response = make_signed_seer_api_request(
            connection_pool=seer_summarization_connection_pool,
            path=SEER_SPAM_DETECTION_ENDPOINT_PATH,
            body=json.dumps(seer_request).encode("utf-8"),
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
