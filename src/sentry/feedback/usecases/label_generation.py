import logging
from typing import TypedDict

import requests
from django.conf import settings

from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


class LabelRequest(TypedDict):
    """Corresponds to GenerateFeedbackLabelsRequest in Seer."""

    organization_id: int
    feedback_message: str


SEER_GENERATE_LABELS_URL = f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/labels"


@metrics.wraps("feedback.generate_labels", sample_rate=1.0)
def generate_labels(feedback_message: str, organization_id: int) -> list[str]:
    """
    Generate labels for a feedback message.

    The possible errors this can throw are:
    - request.exceptions.Timeout, request.exceptions.ConnectionError, etc. while making the request
    - request.exceptions.HTTPError (for raise_for_status)
    - json.JSONDecodeError if the response is not valid JSON
    - KeyError / ValueError if the response JSON doesn't have the expected structure
    - UnicodeDecodeError, TypeError, etc. if the response is not valid UTF-8
    """
    request = LabelRequest(
        organization_id=organization_id,
        feedback_message=feedback_message,
    )

    serialized_request = json.dumps(request)

    response = requests.post(
        SEER_GENERATE_LABELS_URL,
        data=serialized_request,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(serialized_request.encode()),
        },
        timeout=10,
    )

    if response.status_code != 200:
        logger.error(
            "Feedback: Failed to generate labels",
            extra={
                "status_code": response.status_code,
                "response": response.text,
                "content": response.content,
            },
        )

    response.raise_for_status()

    labels = json.loads(response.content.decode("utf-8"))["data"]["labels"]

    # Guaranteed to be a list of strings (validated in Seer)
    return labels
