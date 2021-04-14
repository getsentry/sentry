from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import CommitFileChange, Release, ReleaseCommit, Repository


class CommitFileChangeEndpoint(OrganizationReleasesBaseEndpoint):
    def get(self, request, organization, version):
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

        repo_name = request.query_params.get("repo_name")

        if repo_name:
            try:
                repo = Repository.objects.get(organization_id=organization.id, name=repo_name)
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
