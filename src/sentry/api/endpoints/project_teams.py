from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Team


class ProjectTeamsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a Project's Teams
        ``````````````````````

        Return a list of teams that have access to this project.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :auth: required
        """
        queryset = Team.objects.filter(projectteam__project=project)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
