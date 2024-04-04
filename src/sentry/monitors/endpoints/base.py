from __future__ import annotations

from uuid import UUID

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.exceptions import ParameterValidationError, ResourceDoesNotExist
from sentry.constants import ObjectStatus
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorEnvironment
from sentry.utils.sdk import bind_organization_context, configure_scope

DEPRECATED_INGEST_API_MESSAGE = "We have removed this deprecated API. Please migrate to using DSN instead: https://docs.sentry.io/product/crons/legacy-endpoint-migration/#am-i-using-legacy-endpoints"


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
    """
    Base endpoint class for monitors which will look up the monitor and
    convert it to a Monitor object.
    """

    permission_classes: tuple[type[BasePermission], ...] = (ProjectMonitorPermission,)

    def convert_args(
        self,
        request: Request,
        organization_slug: str,
        monitor_slug: str,
        environment: str | None = None,
        checkin_id: str | None = None,
        *args,
        **kwargs,
    ):
        try:
            organization = Organization.objects.get_from_cache(slug=organization_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            monitor = get_monitor_by_org_slug(organization, monitor_slug)
        except Monitor.DoesNotExist:
            raise ResourceDoesNotExist
        project = Project.objects.get_from_cache(id=monitor.project_id)
        if project.status != ObjectStatus.ACTIVE:
            raise ResourceDoesNotExist

        if environment:
            try:
                environment_object = Environment.objects.get(
                    organization_id=organization.id, name=environment
                )
                monitor_environment = MonitorEnvironment.objects.get(
                    monitor_id=monitor.id, environment_id=environment_object.id
                )
                kwargs["monitor_environment"] = monitor_environment
            except (Environment.DoesNotExist, MonitorEnvironment.DoesNotExist):
                raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization

        kwargs["organization"] = organization
        kwargs["project"] = project
        kwargs["monitor"] = monitor

        if checkin_id:
            checkin = try_checkin_lookup(monitor, checkin_id)
            kwargs["checkin"] = checkin

        return args, kwargs


class ProjectMonitorEndpoint(ProjectEndpoint):
    """
    Base endpoint class for monitors which will look up the monitor and
    convert it to a Monitor object.
    """

    permission_classes: tuple[type[BasePermission], ...] = (ProjectMonitorPermission,)

    def convert_args(
        self,
        request: Request,
        monitor_slug: str,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            kwargs["monitor"] = Monitor.objects.get(
                project_id=kwargs["project"].id, slug=monitor_slug
            )
        except Monitor.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


class ProjectMonitorCheckinEndpoint(ProjectMonitorEndpoint):
    """
    Base endpoint class for monitors which will look up a checkin
    and convert it to a MonitorCheckin object.
    """

    def convert_args(
        self,
        request: Request,
        checkin_id: str,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            kwargs["checkin"] = MonitorCheckIn.objects.get(
                project_id=kwargs["project"].id,
                guid=checkin_id,
            )
        except MonitorCheckIn.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


class ProjectMonitorEnvironmentEndpoint(ProjectMonitorEndpoint):
    """
    Base endpoint class for monitor environment which will look up the monitor environment and
    convert it to a MonitorEnvironment object.
    """

    permission_classes: tuple[type[BasePermission], ...] = (ProjectMonitorPermission,)

    def convert_args(
        self,
        request: Request,
        environment: str,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        monitor = kwargs["monitor"]
        try:
            environment_object = Environment.objects.get(
                organization_id=monitor.organization_id, name=environment
            )
            kwargs["monitor_environment"] = MonitorEnvironment.objects.get(
                monitor_id=monitor.id, environment_id=environment_object.id
            )
        except (Environment.DoesNotExist, MonitorEnvironment.DoesNotExist):
            raise ResourceDoesNotExist

        return args, kwargs


def get_monitor_by_org_slug(organization: Organization, monitor_slug: str) -> Monitor:
    # Since we have changed our unique constraints to be on unique on (project, slug) we can
    # end up with multiple monitors here. Since we have no idea which project the user wants,
    # we just get the oldest monitor and use that.
    # This is a temporary measure until we remove these org level endpoints
    monitors = list(Monitor.objects.filter(organization_id=organization.id, slug=monitor_slug))
    if not monitors:
        raise Monitor.DoesNotExist

    return min(monitors, key=lambda m: m.id)


def try_checkin_lookup(monitor: Monitor, checkin_id: str):
    # we support the magic keyword of "latest" to grab the most recent check-in
    # which is unfinished (thus still mutable)
    if checkin_id == "latest":
        checkin = (
            MonitorCheckIn.objects.filter(monitor=monitor, status=CheckInStatus.IN_PROGRESS)
            .order_by("-date_added")
            .first()
        )
        if not checkin:
            raise ResourceDoesNotExist
        return checkin

    try:
        UUID(checkin_id)
    except ValueError:
        raise ParameterValidationError("Invalid check-in UUID")

    try:
        return MonitorCheckIn.objects.get(monitor=monitor, guid=checkin_id)
    except MonitorCheckIn.DoesNotExist:
        raise ResourceDoesNotExist
