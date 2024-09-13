from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member.response import OrganizationMemberResponse
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.organization_member_examples import OrganizationMemberExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organizationmember import OrganizationMember


@extend_schema(tags=["Projects"])
@region_silo_endpoint
class ProjectMemberIndexEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ENTERPRISE

    @extend_schema(
        operation_id="List a Project's Organization Members",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListOrgMembersResponse", list[OrganizationMemberResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=OrganizationMemberExamples.LIST_ORG_MEMBERS,
    )
    def get(self, request: Request, project) -> Response:
        """
        Returns a list of active organization members that belong to any team assigned to the project.
        """
        queryset = OrganizationMember.objects.filter(
            Q(user_is_active=True, user_id__isnull=False) | Q(user_id__isnull=True),
            organization=project.organization,
            teams__in=project.teams.all(),
        ).distinct()

        member_list = sorted(queryset, key=lambda member: member.email or str(member.id))
        context = serialize(member_list, request.user)

        return Response(context)
