from typing import TypedDict

import requests
from django.conf import settings

from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json, metrics


class LabelRequest(TypedDict):
    """Corresponds to GenerateFeedbackLabelsRequest in Seer."""

    organization_id: int
    feedback_message: str


@metrics.wraps("feedback.generate_labels", sample_rate=1.0)
def generate_labels(feedback_message: str, organization_id: int) -> list[str]:
    request = LabelRequest(
        organization_id=organization_id,
        feedback_message=feedback_message,
    )

    serialized_request = json.dumps(request)

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/labels",
        data=serialized_request,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(serialized_request.encode()),
        },
    )

    if response.status_code != 200:
        # XXX: Should we be raising a more descriptive error here?
        raise Exception(f"Failed to generate labels: {response.status_code} {response.text}")

    # This could throw if not valid JSON or if the structure isn't what we expect
    labels = json.loads(response.content.decode("utf-8"))["data"]["labels"]

    # This is guaranteed to be a list of strings as this is validated in Seer
    return labels
