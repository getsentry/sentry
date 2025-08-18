import logging
from typing import Any

import requests
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationUserReportsPermission
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationSimilarFeedbacksEndpoint(OrganizationEndpoint):
    owner = ApiOwner.FEEDBACK
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationUserReportsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get the similar feedbacks of a user feedback

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :qparam int feedback_id: the id of the feedback to get similar feedbacks for
        :auth: required
        """

        pass

        # How to get similar feedbacks to a given feedback? Use the labels!
        # 1. Get the labels of the feedback, then get all feedbacks that have any of those labels (even a substring of some label is ok!)
        # our dataset is now these feedbacks,
        #


def make_seer_request(request: Any) -> bytes:
    serialized_request = json.dumps(request)

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/summarize",
        data=serialized_request,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(serialized_request.encode()),
        },
    )

    if response.status_code != 200:
        logger.error(
            "Feedback: Failed to produce a summary for a list of feedbacks",
            extra={
                "status_code": response.status_code,
                "response": response.text,
                "content": response.content,
            },
        )

    response.raise_for_status()

    return response.content
