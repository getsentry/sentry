from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.commit import CommitSerializerResponse
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.commit import Commit
from sentry.models.repository import Repository


@region_silo_endpoint
@extend_schema(tags=["Organizations"])
class OrganizationRepositoryCommitsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="List a Repository's Commits",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="repo_id",
                description="The repository ID.",
                required=True,
                type=str,
                location="path",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "CommitSerializerResponse",
                list[CommitSerializerResponse],
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                name="Repository Commits",
                value=[
                    {
                        "dateCreated": "2018-11-06T21:19:58.536Z",
                        "id": "acbafc639127fd89d10f474520104517ff1d709e",
                        "message": "Initial commit from Create Next App",
                        "suspectCommitType": "",
                        "pullRequest": None,
                    }
                ],
            ),
        ],
    )
    def get(self, request: Request, organization, repo_id) -> Response:
        """
        List a Repository's Commits
        """
        try:
            repo = Repository.objects.get(id=repo_id, organization_id=organization.id)
        except Repository.DoesNotExist:
            raise ResourceDoesNotExist

        queryset = Commit.objects.filter(repository_id=repo.id).select_related("author")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=DateTimePaginator,
        )
