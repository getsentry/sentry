import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.models.group import Group


logger = logging.getLogger(__name__)


def _fix_label(label):
    return label


@region_silo_endpoint
class GroupSimilarIssuesEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, group: Group) -> Response:
        # Similarity module has been removed, returning empty response
        return Response([])
