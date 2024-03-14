from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.issues.related import find_related_issues
from sentry.models.group import Group

# from sentry import features


@region_silo_endpoint
class RelatedIssuesEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}

    def get(self, _: Request, group: Group) -> Response:
        # XXX: Add real feature flag
        # if not features.has("FOO", organization, actor=request.user):
        #     return Response({"status": "disabled"}, status=403)
        related_issues = find_related_issues(group)
        return Response({key: [g.id for g in groups] for key, groups in related_issues.items()})
