from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.commit import CommitSerializerResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.release_examples import ReleaseExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, ReleaseParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class OrganizationReleaseCommitsEndpoint(OrganizationReleasesBaseEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="listOrganizationReleaseCommits",
        summary="List an Organization Release's Commits",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            ReleaseParams.VERSION,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizationReleaseCommitsResponse", list[CommitSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReleaseExamples.LIST_RELEASE_COMMITS,
    )
    def get(
        self, request: Request, organization, version
    ) -> Response[list[CommitSerializerResponse]]:
        """
        Retrieve a list of commits for a given release.
        """
        try:
            release = Release.objects.distinct().get(
                organization_id=organization.id,
                projects__in=self.get_projects(request, organization),
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        queryset = ReleaseCommit.objects.filter(release=release).select_related(
            "commit", "commit__author"
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="order",
            on_results=lambda x: serialize([rc.commit for rc in x], request.user),
        )
