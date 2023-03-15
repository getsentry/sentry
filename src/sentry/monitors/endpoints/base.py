from __future__ import annotations

from uuid import UUID

from rest_framework.request import Request

from sentry.api.authentication import ApiKeyAuthentication, DSNAuthentication, TokenAuthentication
from sentry.api.base import Endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases.project import ProjectPermission
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


class MonitorEndpoint(Endpoint):
    """
    Base endpoint class for monitors which will lookup the monitor ID and
    convert it to a Monitor object.

    Currently this has two strategies for monitor lookup

    1. Via the monitor slug. In this scenario the organization_slug MUST be
       present, since monitor slugs are unique with the organization_slug

    2. Via the monitor GUID. In this scenario the organization_slug is not
       required as GUIDs are global to sentry. We will check that the
       organization resulting from the monitor project

    [!!]: This base endpoint is NOT used for legacy ingestion endpoints, see
          MonitorIngestEndpoint for that.
    """

    permission_classes = (ProjectMonitorPermission,)

    def convert_args(
        self,
        request: Request,
        organization_slug: str,
        monitor_id: str,
        checkin_id: str | None = None,
        *args,
        **kwargs,
    ):
        try:
            organization = Organization.objects.get_from_cache(slug=organization_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            # Try lookup by slug first
            monitor = Monitor.objects.get(organization_id=organization.id, slug=monitor_id)
        except Monitor.DoesNotExist:
            # Try lookup by GUID. We cannot consolidate this into one query as
            # we need to validate the slug is a GUID before trying to query on
            # the GUID column, otherwise we'll produce a postgres error
            try:
                UUID(monitor_id)
            except ValueError:
                # This error is a bit confusing, because this may also mean
                # that we've failed to lookup their monitor by slug.
                raise ParameterValidationError("Invalid monitor UUID")
            try:
                monitor = Monitor.objects.get(organization_id=organization.id, guid=monitor_id)
            except Monitor.DoesNotExist:
                raise ResourceDoesNotExist

        project = Project.objects.get_from_cache(id=monitor.project_id)
        if project.status != ProjectStatus.VISIBLE:
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


class MonitorIngestEndpoint(Endpoint):
    """
    This type of endpont explicitly only allows for DSN and Token / Key based authentication.

    [!!]: These endpoints support routes which **do not specify the
          organization slug**! This endpoint is extra careful in those cases to
          validate

    [!!]: These endpoints are legacy and will be replaced by relay based
          checkin ingestion in the very near future.
    """

    authentication_classes = (DSNAuthentication, TokenAuthentication, ApiKeyAuthentication)
    permission_classes = (ProjectMonitorPermission,)

    # TODO(dcramer): this code needs shared with other endpoints as its security focused
    # TODO(dcramer): this doesnt handle is_global roles
    def convert_args(
        self,
        request: Request,
        monitor_id: str,
        checkin_id: str | None = None,
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

        # Validate that the authenticated project matches the monitor. This is
        # used for DSN style authentication
        if hasattr(request.auth, "project_id") and project.id != request.auth.project_id:
            raise ResourceDoesNotExist

        # When looking up via GUID we do not check the organiation slug,
        # validate that the slug matches the org of the monitors project
        if organization_slug and project.organization.slug != organization_slug:
            raise ResourceDoesNotExist

        # Check project permission. Required for Token style authentication
        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization

        kwargs["project"] = project
        kwargs["monitor"] = monitor

        if checkin_id:
            checkin = try_checkin_lookup(monitor, checkin_id)
            kwargs["checkin"] = checkin

        return args, kwargs


def try_checkin_lookup(monitor: Monitor, checkin_id: str):
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
        return checkin

    try:
        UUID(checkin_id)
    except ValueError:
        raise ParameterValidationError("Invalid check-in UUID")

    try:
        return MonitorCheckIn.objects.get(monitor=monitor, guid=checkin_id)
    except MonitorCheckIn.DoesNotExist:
        raise ResourceDoesNotExist
