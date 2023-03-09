from __future__ import annotations

from uuid import UUID

from rest_framework.request import Request

from sentry.api.authentication import DSNAuthentication
from sentry.api.base import Endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases.project import ProjectPermission
from sentry.api.endpoints.event_attachment_details import EventAttachmentDetailsPermission
from sentry.api.exceptions import ParameterValidationError, ResourceDoesNotExist
from sentry.models import Organization, Project, ProjectStatus
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn
from sentry.utils.sdk import bind_organization_context, configure_scope


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


class MonitorCheckInAttachmentPermission(EventAttachmentDetailsPermission):
    scope_map = ProjectMonitorPermission.scope_map

    def has_object_permission(self, request: Request, view, project):
        result = super().has_object_permission(request, view, project)

        # Allow attachment uploads via DSN
        if request.method == "POST":
            return True

        return result


class MonitorEndpoint(Endpoint):
    permission_classes = (ProjectMonitorPermission,)

    def convert_args(
        self,
        request: Request,
        monitor_id: str,
        organization_slug: str | None = None,
        *args,
        **kwargs,
    ):
        organization = None
        monitor = None

        # The only monitor endpoints that do not have the org slug in their
        # parameters are the GUID-style checkin endpoints
        if organization_slug:
            try:
                organization = Organization.objects.get_from_cache(slug=organization_slug)
                # Try lookup by slug first. This requires organization context since
                # slugs are unique only to the organization
                monitor = Monitor.objects.get(organization_id=organization.id, slug=monitor_id)
            except (Organization.DoesNotExist, Monitor.DoesNotExist):
                pass

        # Try lookup by GUID
        if not monitor:
            # Validate GUIDs
            try:
                UUID(monitor_id)
            except ValueError:
                # This error is a bit confusing, because this may also mean
                # that we've failed to lookup their monitor by slug.
                raise ParameterValidationError("Invalid monitor UUID")
            # When looking up by guid we don't include the org conditional
            # (since GUID lookup allows orgless routes), we will validate
            # permissions later in this function
            try:
                monitor = Monitor.objects.get(guid=monitor_id)
            except Monitor.DoesNotExist:
                raise ResourceDoesNotExist

        project = Project.objects.get_from_cache(id=monitor.project_id)
        if project.status != ProjectStatus.VISIBLE:
            raise ResourceDoesNotExist

        # Validate that the authenticated project matches the monitor
        if hasattr(request.auth, "project_id") and project.id != request.auth.project_id:
            raise ResourceDoesNotExist

        # When looking up via GUID we do not check the organiation slug,
        # validate that the slug matches the org of the monitors project
        if organization_slug and project.organization.slug != organization_slug:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization

        kwargs.update({"monitor": monitor, "project": project})
        return args, kwargs


class MonitorCheckInEndpoint(MonitorEndpoint):
    # Checkins are available via DNS authentication
    authentication_classes = MonitorEndpoint.authentication_classes + (DSNAuthentication,)

    # TODO(dcramer): this code needs shared with other endpoints as its security focused
    # TODO(dcramer): this doesnt handle is_global roles
    def convert_args(
        self,
        request: Request,
        monitor_id: str,
        checkin_id: str | None = None,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, monitor_id, *args, **kwargs)

        # Ignore lookup of checkin if no ID is present
        if checkin_id is None:
            return args, kwargs

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
                UUID(checkin_id)
            except ValueError:
                raise ParameterValidationError("Invalid check-in UUID")

            try:
                checkin = MonitorCheckIn.objects.get(monitor=monitor, guid=checkin_id)
            except MonitorCheckIn.DoesNotExist:
                raise ResourceDoesNotExist

        kwargs.update({"checkin": checkin})
        return args, kwargs
