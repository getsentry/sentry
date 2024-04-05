from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.issues.related import find_related_issues
from sentry.models.group import Group


@region_silo_endpoint
class RelatedIssuesEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}

    def get(self, _: Request, group: Group) -> Response:
        related_issues = find_related_issues(group)
        # Backward compatible for UI
        response = {
            related_set["type"]: [g.id for g in related_set["data"]]
            for related_set in related_issues
        }
        response["data"] = [
            {"type": related_set["type"], "data": [g.id for g in related_set["data"]]}
            for related_set in related_issues
        ]
        return Response(response)
