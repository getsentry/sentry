import logging
from typing import TypedDict

from django.conf import settings

from sentry.net.http import connection_from_url
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

SEER_LABEL_GENERATION_ENDPOINT_URL = "v1/automation/summarize/feedback/labels"

seer_connection_pool = connection_from_url(
    settings.SEER_AUTOFIX_URL, timeout=getattr(settings, "SEER_DEFAULT_TIMEOUT", 5)
)


@metrics.wraps("feedback.generate_labels", sample_rate=1.0)
def generate_labels(feedback_message: str, organization_id: int) -> list[str]:
    """
    Generate labels for a feedback message.

    Raises an exception if anything goes wrong during the API call or response processing.
    """
    request = LabelRequest(
        organization_id=organization_id,
        feedback_message=feedback_message,
    )

    try:
        response = make_signed_seer_api_request(
            connection_pool=seer_connection_pool,
            path=SEER_LABEL_GENERATION_ENDPOINT_URL,
            body=json.dumps(request).encode("utf-8"),
        )
        response_data = json.loads(response.data.decode("utf-8"))
    except Exception as e:
        logger.exception(
            "Failed to generate labels",
            extra={
                "error": type(e).__name__,
            },
        )
        raise Exception("Seer label generation endpoint failed")

    if response.status < 200 or response.status >= 300:
        logger.error(
            "Failed to generate labels",
            extra={
                "status_code": response.status,
                "response_data": response.data if response else None,
            },
        )
        raise Exception(f"Seer label generation endpoint returned status {response.status}")

    labels = response_data["data"]["labels"]

    # Guaranteed to be a list of strings (validated in Seer)
    return labels
