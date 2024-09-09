from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models.organizationmember import OrganizationMember


@region_silo_endpoint
class ProjectMemberIndexEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ENTERPRISE

    def get(self, request: Request, project) -> Response:
        """
        List your Members in the requested Project
        ```````````````````````````````````````````

        Return a list of active organization members that belong to any team assigned
        to the queried project.
        """
        queryset = OrganizationMember.objects.filter(
            Q(user_is_active=True, user_id__isnull=False) | Q(user_id__isnull=True),
            organization=project.organization,
            teams__in=project.teams.all(),
        ).distinct()

        member_list = sorted(queryset, key=lambda member: member.email or str(member.id))
        context = serialize(member_list, request.user)

        return Response(context)
