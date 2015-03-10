from __future__ import absolute_import

from django.http import HttpResponseRedirect

from sentry.api.base import Endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Project
from sentry.utils.http import absolute_uri


class LegacyProjectRedirectEndpoint(Endpoint):
    permission_classes = (ProjectPermission,)

    def convert_args(self, request, project_id, *args, **kwargs):
        try:
            project = Project.objects.get_from_cache(
                id=project_id,
            )
        except Project.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        kwargs['project'] = project
        return (args, kwargs)

    def get(self, request, project, path):
        """
        Retrieve a project

        Return details on an individual project.

            {method} {path}

        """
        return HttpResponseRedirect(
            absolute_uri('/api/0/projects/{}/{}/{}'.format(
                project.organization.slug,
                project.slug,
                path or '',
            ))
        )
