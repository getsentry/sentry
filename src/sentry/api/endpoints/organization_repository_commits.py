from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.models import Commit, Repository


class OrganizationRepositoryCommitsEndpoint(OrganizationEndpoint):
    def get(self, request, organization, repo_id):
        """
        List a Repository's Commits
        ```````````````````````````

        Return a list of commits for a given repository.

        :pparam string organization_slug: the organization short name
        :pparam string repo_id: the repository ID
        :auth: required
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
