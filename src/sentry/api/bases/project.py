from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Project


class ProjectEndpoint(Endpoint):
    def convert_args(self, request, organization_slug, project_slug, *args, **kwargs):
        try:
            project = Project.objects.get(
                organization__slug=organization_slug,
                slug=project_slug,
            )
        except Project.DoesNotExist:
            raise ResourceDoesNotExist

        kwargs['project'] = project
        return (args, kwargs)
