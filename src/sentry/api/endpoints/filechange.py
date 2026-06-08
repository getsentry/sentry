from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.filechange import CommitFileChangeSerializerResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, ReleaseParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository

_REPOSITORY_ID_QUERY_PARAM = OpenApiParameter(
    name="repo_id",
    location=OpenApiParameter.QUERY,
    required=False,
    type=str,
    description="The repository external ID to filter file changes by.",
)
_REPOSITORY_NAME_QUERY_PARAM = OpenApiParameter(
    name="repo_name",
    location=OpenApiParameter.QUERY,
    required=False,
    type=str,
    description="The repository name to filter file changes by.",
)


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class CommitFileChangeEndpoint(OrganizationReleasesBaseEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve Files Changed in a Release's Commits",
        description="Retrieve files changed in a release's commits.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            ReleaseParams.VERSION,
            _REPOSITORY_ID_QUERY_PARAM,
            _REPOSITORY_NAME_QUERY_PARAM,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizationReleaseCommitFilesResponse",
                list[CommitFileChangeSerializerResponse],
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization, version
    ) -> Response[list[CommitFileChangeSerializerResponse]]:
        try:
            release = Release.objects.get(organization=organization, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        release_commit_ids = list(
            ReleaseCommit.objects.filter(release=release).values_list("commit_id", flat=True)
        )

        queryset = CommitFileChange.objects.filter(commit_id__in=release_commit_ids)

        repo_id = request.query_params.get("repo_id")
        repo_name = request.query_params.get("repo_name")

        if repo_id or repo_name:
            try:
                if repo_id:
                    repo = Repository.objects.get(
                        organization_id=organization.id,
                        external_id=repo_id,
                        status=ObjectStatus.ACTIVE,
                    )
                else:
                    repo = Repository.objects.get(
                        organization_id=organization.id, name=repo_name, status=ObjectStatus.ACTIVE
                    )

                commit_ids_for_repo = list(
                    Commit.objects.filter(
                        id__in=release_commit_ids, repository_id=repo.id
                    ).values_list("id", flat=True)
                )
                queryset = queryset.filter(commit_id__in=commit_ids_for_repo)
            except Repository.DoesNotExist:
                raise ResourceDoesNotExist

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="filename",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
