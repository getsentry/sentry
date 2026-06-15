from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.repository import RepositorySerializerResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, ReleaseParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class ProjectReleaseRepositories(ProjectEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (ProjectReleasePermission,)

    @extend_schema(
        operation_id="Retrieve a Project Release's Repositories",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListProjectReleaseRepositoriesResponse", list[RepositorySerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, project, version
    ) -> Response[list[RepositorySerializerResponse]]:
        """
        Return the repositories that have commits associated with a given release.
        """

        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        release_commits = ReleaseCommit.objects.filter(release=release).select_related("commit")

        repository_ids = {c.commit.repository_id for c in release_commits}

        repositories = Repository.objects.filter(id__in=repository_ids)

        data: list[RepositorySerializerResponse] = serialize(list(repositories), request.user)
        return Response(data)
