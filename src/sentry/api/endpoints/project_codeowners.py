from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProjectCodeOwners


class ProjectCodeOwnersEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        Retrieve List of CODEOWNERS configurations for a project
        ````````````````````````````````````````````

        Return a list of a project's CODEOWNERS configuration.

        :auth: required
        """
        codeowners = list(ProjectCodeOwners.objects.filter(project=project))

        return Response(serialize(codeowners, request.user))
