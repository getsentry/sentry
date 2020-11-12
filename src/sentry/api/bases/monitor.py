from __future__ import absolute_import

from sentry import features
from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.bases.project import ProjectPermission
from sentry.models import Monitor, Project, ProjectStatus
from sentry.utils.sdk import configure_scope, bind_organization_context


class MonitorEndpoint(Endpoint):
    permission_classes = (ProjectPermission,)

    def convert_args(self, request, monitor_id, *args, **kwargs):
        try:
            monitor = Monitor.objects.get(guid=monitor_id)
        except Monitor.DoesNotExist:
            raise ResourceDoesNotExist

        project = Project.objects.get_from_cache(id=monitor.project_id)
        if project.status != ProjectStatus.VISIBLE:
            raise ResourceDoesNotExist

        # HACK: This doesn't work since we can't return a 400 from here,
        # and actually just results in a 500.
        if hasattr(request.auth, "project_id") and project.id != request.auth.project_id:
            return self.respond(status=400)

        if not features.has("organizations:monitors", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization

        kwargs.update({"monitor": monitor, "project": project})
        return (args, kwargs)
