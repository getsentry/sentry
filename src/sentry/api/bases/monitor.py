from __future__ import annotations

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases.project import ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, Project, ProjectStatus
from sentry.utils.sdk import bind_organization_context, configure_scope


class InvalidAuthProject(Exception):
    pass


class OrganizationMonitorPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }


class ProjectMonitorPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:read", "project:write", "project:admin"],
        "PUT": ["project:read", "project:write", "project:admin"],
        "DELETE": ["project:read", "project:write", "project:admin"],
    }


class MonitorEndpoint(Endpoint):
    permission_classes = (ProjectMonitorPermission,)

    @staticmethod
    def respond_invalid() -> Response:
        return Response(status=status.HTTP_400_BAD_REQUEST, data={"details": "Invalid monitor"})

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


class MonitorCheckInEndpoint(MonitorEndpoint):
    # TODO(dcramer): this code needs shared with other endpoints as its security focused
    # TODO(dcramer): this doesnt handle is_global roles
    def convert_args(
        self,
        request: Request,
        monitor_id,
        checkin_id,
        organization_slug: str | None = None,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, monitor_id, *args, **kwargs)

        monitor = kwargs["monitor"]
        # we support the magic keyword of "latest" to grab the most recent check-in
        # which is unfinished (thus still mutable)
        if checkin_id == "latest":
            checkin = (
                MonitorCheckIn.objects.filter(monitor=monitor)
                .exclude(status__in=CheckInStatus.FINISHED_VALUES)
                .order_by("-date_added")
                .first()
            )
            if not checkin:
                raise ResourceDoesNotExist
        else:
            try:
                checkin = MonitorCheckIn.objects.get(monitor=monitor, guid=checkin_id)
            except MonitorCheckIn.DoesNotExist:
                raise ResourceDoesNotExist

        kwargs.update({"checkin": checkin})
        return args, kwargs
