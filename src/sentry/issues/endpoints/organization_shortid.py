from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models.group import Group


@region_silo_endpoint
class ShortIdLookupEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, group: Group) -> Response:
        """
        Resolve a Short ID
        ``````````````````

        This resolves a short ID or internal issue ID to the project slug and group details.

        :pparam string issue_id: the short ID or issue ID to look up.
        :auth: required
        """
        return Response(
            {
                "organizationSlug": group.project.organization.slug,
                "projectSlug": group.project.slug,
                "groupId": str(group.id),
                "group": serialize(group, request.user),
                "shortId": group.qualified_short_id,
            }
        )
