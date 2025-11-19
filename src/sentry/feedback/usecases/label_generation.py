import logging
from typing import TypedDict

from sentry.feedback.lib.seer_api import seer_summarization_connection_pool
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


class LabelRequest(TypedDict):
    """Corresponds to GenerateFeedbackLabelsRequest in Seer."""

    organization_id: int
    feedback_message: str


AI_LABEL_TAG_PREFIX = "ai_categorization"
# If Seer generates more labels, we truncate it to this many labels
MAX_AI_LABELS = 15
# Max length of the serialized list of labels, which matches the max length of a tag value, from https://docs.sentry.io/platforms/javascript/enriching-events/tags/
MAX_AI_LABELS_JSON_LENGTH = 200

SEER_LABEL_GENERATION_ENDPOINT_PATH = "/v1/automation/summarize/feedback/labels"
SEER_TIMEOUT_S = 15
SEER_RETRIES = 0  # Do not retry since this is called in ingest.


@metrics.wraps("feedback.generate_labels")
def generate_labels(feedback_message: str, organization_id: int) -> list[str]:
    """
    Generate labels for a feedback message.

    Raises exception if anything goes wrong during the API call or response processing.
    """
    request = LabelRequest(
        feedback_message=feedback_message,
        organization_id=organization_id,
    )

    try:
        response = make_signed_seer_api_request(
            connection_pool=seer_summarization_connection_pool,
            path=SEER_LABEL_GENERATION_ENDPOINT_PATH,
            body=json.dumps(request).encode("utf-8"),
            timeout=SEER_TIMEOUT_S,
            retries=SEER_RETRIES,
        )
    except Exception:
        logger.exception("Seer failed to generate user feedback labels")
        raise

    if response.status < 200 or response.status >= 300:
        logger.error(
            "Seer failed to generate user feedback labels",
            extra={"status_code": response.status, "response_data": response.data},
        )
        raise Exception("Seer returned non-200 response")

    # Guaranteed to be a list of strings (validated in Seer)
    return response.json()["data"]["labels"]
