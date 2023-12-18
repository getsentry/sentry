from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository


@region_silo_endpoint
class CommitFileChangeEndpoint(OrganizationReleasesBaseEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization, version) -> Response:
        """
        Retrieve Files Changed in a Release's Commits
        `````````````````````````````````````````````

        Retrieve a list of files that were changed in a given release's commits.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.

        :pparam string repo_name: the repository name

        :auth: required


        """

        try:
            release = Release.objects.get(organization=organization, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        queryset = CommitFileChange.objects.filter(
            commit_id__in=ReleaseCommit.objects.filter(release=release).values_list(
                "commit_id", flat=True
            )
        )

        repo_id = request.query_params.get("repo_id")
        repo_name = request.query_params.get("repo_name")

        # prefer repo external ID to name
        if repo_id:
            try:
                repo = Repository.objects.get(
                    organization_id=organization.id, external_id=repo_id, status=ObjectStatus.ACTIVE
                )
                queryset = queryset.filter(commit__repository_id=repo.id)
            except Repository.DoesNotExist:
                raise ResourceDoesNotExist

        elif repo_name:
            try:
                repo = Repository.objects.get(
                    organization_id=organization.id, name=repo_name, status=ObjectStatus.ACTIVE
                )
                queryset = queryset.filter(commit__repository_id=repo.id)
            except Repository.DoesNotExist:
                raise ResourceDoesNotExist

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="filename",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
