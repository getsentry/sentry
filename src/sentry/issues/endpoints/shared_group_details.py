from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import DEFAULT_DURATION_BUDGET, Endpoint, cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environment_func
from sentry.api.serializers import SharedGroupSerializer, serialize
from sentry.api.serializers.models.group import SharedGroupSerializerResponse
from sentry.apidocs.constants import RESPONSE_NOT_FOUND
from sentry.apidocs.examples.issue_examples import IssueExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.group import Group


@extend_schema(tags=["Events"])
@cell_silo_endpoint
class SharedGroupDetailsEndpoint(Endpoint):
    owner = ApiOwner.ISSUES
    max_acceptable_duration = DEFAULT_DURATION_BUDGET
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = ()

    @extend_schema(
        operation_id="getOrganizationSharedIssue",
        summary="Retrieve a Shared Issue",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            OpenApiParameter(
                name="share_id",
                location="path",
                required=True,
                type=str,
                description="The share ID of the issue, from its public share link.",
            ),
        ],
        # The share ID grants access, so the endpoint takes no authentication.
        auth=[],
        responses={
            200: inline_sentry_response_serializer(
                "SharedIssueResponse", SharedGroupSerializerResponse
            ),
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueExamples.SHARED_ISSUE_DETAILS,
    )
    def get(
        self,
        request: Request,
        organization_id_or_slug: int | str | None = None,
        share_id: str | None = None,
    ) -> Response[SharedGroupSerializerResponse]:
        """
        Return an issue that was shared with a public link. This endpoint doesn't need
        authentication: the share ID grants access.

        The response holds less than the issue details endpoint, and its latest event
        leaves out the user, tags, contexts, SDK, extra data, processing errors and
        breadcrumbs.

        Returns 404 when the share ID doesn't exist, when the issue belongs to another
        organization, or when the organization turned off issue sharing.
        """
        if share_id is None:
            raise ResourceDoesNotExist

        try:
            group = Group.objects.from_share_id(share_id)
        except Group.DoesNotExist:
            raise ResourceDoesNotExist

        # Checks if the organization_id_or_slug matches the group organization's id or slug
        if organization_id_or_slug:
            if str(organization_id_or_slug).isdecimal():
                if int(organization_id_or_slug) != group.organization.id:
                    raise ResourceDoesNotExist
            else:
                if organization_id_or_slug != group.organization.slug:
                    raise ResourceDoesNotExist

        if group.organization.flags.disable_shared_issues:
            raise ResourceDoesNotExist

        context: SharedGroupSerializerResponse = serialize(
            group,
            request.user,
            SharedGroupSerializer(
                environment_func=get_environment_func(request, group.project.organization_id)
            ),
        )
        return Response(context)
