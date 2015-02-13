from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Project


class ProjectEndpoint(Endpoint):
    def convert_args(self, request, project_id, *args, **kwargs):
        try:
            project = Project.objects.get_from_cache(
                id=project_id,
            )
        except Project.DoesNotExist:
            raise ResourceDoesNotExist

        kwargs['project'] = project
        return (args, kwargs)
