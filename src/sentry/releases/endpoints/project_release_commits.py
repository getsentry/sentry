from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.commit import CommitSerializerResponseWithReleases
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.release_examples import ReleaseExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, ReleaseParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository

_REPOSITORY_ID_QUERY_PARAM = OpenApiParameter(
    name="repo_id",
    location=OpenApiParameter.QUERY,
    required=False,
    type=str,
    description="The repository external ID to filter commits by.",
)
_REPOSITORY_NAME_QUERY_PARAM = OpenApiParameter(
    name="repo_name",
    location=OpenApiParameter.QUERY,
    required=False,
    type=str,
    description="The repository name to filter commits by.",
)


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class ProjectReleaseCommitsEndpoint(ProjectEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (ProjectReleasePermission,)

    @extend_schema(
        operation_id="List a Project Release's Commits",
        description="List a project release's commits.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
            _REPOSITORY_ID_QUERY_PARAM,
            _REPOSITORY_NAME_QUERY_PARAM,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListProjectReleaseCommitsResponse", list[CommitSerializerResponseWithReleases]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReleaseExamples.LIST_RELEASE_COMMITS,
    )
    def get(
        self, request: Request, project, version
    ) -> Response[list[CommitSerializerResponseWithReleases]]:
        organization_id = project.organization_id

        try:
            release = Release.objects.get(
                organization_id=organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        queryset = ReleaseCommit.objects.filter(release=release).select_related(
            "commit", "commit__author"
        )

        repo_id = request.query_params.get("repo_id")
        repo_name = request.query_params.get("repo_name")

        # prefer repo external ID to name
        # NOTE: We filter on Repository here instead of using get b/c sometimes,
        # we have have multiple repos for the same external_id/name that differ
        # in other fields that differ such as 'provider' or 'config'.
        if repo_id:
            repos = Repository.objects.filter(
                organization_id=organization_id, external_id=repo_id, status=ObjectStatus.ACTIVE
            ).order_by("-date_added")

            latest_repo = repos.first()
            if latest_repo is None:
                raise ResourceDoesNotExist

            queryset = queryset.filter(commit__repository_id=latest_repo.id)

        if repo_name:
            repos = Repository.objects.filter(
                organization_id=organization_id, name=repo_name, status=ObjectStatus.ACTIVE
            ).order_by("-date_added")

            latest_repo = repos.first()
            if latest_repo is None:
                raise ResourceDoesNotExist

            queryset = queryset.filter(commit__repository_id=latest_repo.id)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="order",
            on_results=lambda x: serialize([rc.commit for rc in x], request.user),
        )
