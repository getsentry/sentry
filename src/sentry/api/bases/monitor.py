from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import Endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Monitor, Project, ProjectStatus
from sentry.utils.sdk import bind_organization_context, configure_scope


class InvalidAuthProject(Exception):
    pass


class MonitorEndpoint(Endpoint):
    permission_classes = (ProjectPermission,)

    def convert_args(self, request: Request, monitor_id, *args, **kwargs):
        try:
            monitor = Monitor.objects.get(guid=monitor_id)
        except Monitor.DoesNotExist:
            raise ResourceDoesNotExist

        project = Project.objects.get_from_cache(id=monitor.project_id)
        if project.status != ProjectStatus.VISIBLE:
            raise ResourceDoesNotExist

        if hasattr(request.auth, "project_id") and project.id != request.auth.project_id:
            raise InvalidAuthProject

        if not features.has("organizations:monitors", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization

        kwargs.update({"monitor": monitor, "project": project})
        return args, kwargs

    def handle_exception(self, request: Request, exc: Exception) -> Response:
        if isinstance(exc, InvalidAuthProject):
            return self.respond(status=400)
        return super().handle_exception(request, exc)
