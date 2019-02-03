from __future__ import absolute_import

from sentry import features
from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.bases.project import ProjectPermission
from sentry.models import Monitor, Project, ProjectStatus
from sentry.utils.sdk import configure_scope


class MonitorEndpoint(Endpoint):
    permission_classes = (ProjectPermission,)

    def convert_args(self, request, monitor_id, *args, **kwargs):
        try:
            monitor = Monitor.objects.get(
                guid=monitor_id,
            )
        except Monitor.DoesNotExist:
            raise ResourceDoesNotExist

        project = Project.objects.get_from_cache(id=monitor.project_id)
        if project.status != ProjectStatus.VISIBLE:
            raise ResourceDoesNotExist

        if hasattr(request.auth, 'project_id') and project.id != request.auth.project_id:
            return self.respond(status=400)

        if not features.has('organizations:monitors',
                            project.organization, actor=request.user):
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("organization", project.organization_id)
            scope.set_tag("project", project.id)

        request._request.organization = project.organization

        kwargs.update({
            'monitor': monitor,
            'project': project,
        })
        return (args, kwargs)
