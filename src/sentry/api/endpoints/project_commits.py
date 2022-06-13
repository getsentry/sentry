from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import ReleaseCommit


class ProjectCommitsEndpoint(ProjectEndpoint):
    private = True
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project) -> Response:
        """
        List a Project's Commits
        `````````````````````````

        Retrieve a list of commits for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          commit belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     commits of.
        """

        try:
            queryset = ReleaseCommit.objects.filter(
                organization_id=project.organization_id, project_id=project.id
            )
        except ReleaseCommit.DoesNotExist:
            raise ResourceDoesNotExist

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="order",
            on_results=lambda x: serialize([rc.commit for rc in x], request.user),
        )
