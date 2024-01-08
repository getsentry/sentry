from __future__ import annotations

from uuid import UUID

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.authentication import (
    ApiKeyAuthentication,
    DSNAuthentication,
    OrgAuthTokenAuthentication,
    UserAuthTokenAuthentication,
)
from sentry.api.base import Endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases.project import ProjectPermission
from sentry.api.exceptions import ParameterValidationError, ResourceDoesNotExist
from sentry.constants import ObjectStatus
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorEnvironment
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
    Base endpoint class for monitors which will look up the monitor and
    convert it to a Monitor object.

    [!!]: This base endpoint is NOT used for legacy ingestion endpoints, see
          MonitorIngestEndpoint for that.
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
            monitor = Monitor.objects.get(organization_id=organization.id, slug=monitor_slug)
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


class MonitorIngestEndpoint(Endpoint):
    """
    This type of endpoint explicitly only allows for DSN and Token / Key based authentication.

    [!!]: These endpoints are legacy and will be replaced by relay based
          checkin ingestion in the very near future.

    [!!]: These endpoints support routes which **do not specify the
          organization slug**! This endpoint is extra careful in those cases to
          validate

    [!!]: This type of endpoint supports lookup of monitors by slug AND by
          GUID. However, slug lookup is **ONLY** supported in two scenarios:

          - When the organization slug is part of the URL parameters.
          - When using DSN auth
    """

    owner = ApiOwner.CRONS
    authentication_classes = (
        DSNAuthentication,
        UserAuthTokenAuthentication,
        OrgAuthTokenAuthentication,
        ApiKeyAuthentication,
    )
    permission_classes = (ProjectMonitorPermission,)

    allow_auto_create_monitors = False
    """
    Loosens the base endpoint such that a monitor with the provided monitor_slug
    does not need to exist. This is used for initial checkin creation with
    monitor upsert.

    [!!]: This will ONLY work when using DSN auth.
    """

    # TODO(dcramer): this code needs shared with other endpoints as its security focused
    # TODO(dcramer): this doesnt handle is_global roles
    def convert_args(
        self,
        request: Request,
        monitor_slug: str,
        checkin_id: str | None = None,
        organization_slug: str | None = None,
        *args,
        **kwargs,
    ):
        monitor = None

        # Include monitor_slug in kwargs when upsert is enabled
        if self.allow_auto_create_monitors:
            kwargs["monitor_slug"] = monitor_slug

        using_dsn_auth = isinstance(request.auth, ProjectKey)

        # When using DSN auth we're able to infer the organization slug
        if not organization_slug and using_dsn_auth:
            organization_slug = request.auth.project.organization.slug

        # The only monitor endpoints that do not have the org slug in their
        # parameters are the GUID-style checkin endpoints
        if organization_slug:
            try:
                organization = Organization.objects.get_from_cache(slug=organization_slug)
                # Try lookup by slug first. This requires organization context since
                # slugs are unique only to the organization
                monitor = Monitor.objects.get(organization_id=organization.id, slug=monitor_slug)
            except (Organization.DoesNotExist, Monitor.DoesNotExist):
                pass

        # Try lookup by GUID
        if not monitor:
            # Validate GUIDs
            try:
                UUID(monitor_slug)
                # When looking up by guid we don't include the org conditional
                # (since GUID lookup allows orgless routes), we will validate
                # permissions later in this function
                try:
                    monitor = Monitor.objects.get(guid=monitor_slug)
                except Monitor.DoesNotExist:
                    monitor = None
            except ValueError:
                # If it's an invalid GUID it could mean the user wants to
                # create this monitor, we can't raise an error in that case
                if not self.allow_auto_create_monitors:
                    # This error is a bit confusing, because this may also mean
                    # that we've failed to look up their monitor by slug.
                    raise ParameterValidationError("Invalid monitor UUID")

        if not monitor and not self.allow_auto_create_monitors:
            raise ResourceDoesNotExist

        # Monitor ingestion supports upsert of monitors This is currently only
        # supported when using DSN auth.
        if not monitor and not using_dsn_auth:
            raise ResourceDoesNotExist

        # No monitor is allowed when using DSN auth. Use the project from the
        # DSN auth and allow the monitor to be empty. This should be handled in
        # the endpoint
        if not monitor:
            project = request.auth.project
        else:
            project = Project.objects.get_from_cache(id=monitor.project_id)

        if project.status != ObjectStatus.ACTIVE:
            raise ResourceDoesNotExist

        # Validate that the authenticated project matches the monitor. This is
        # used for DSN style authentication
        if using_dsn_auth and project.id != request.auth.project_id:
            raise ResourceDoesNotExist

        # When looking up via GUID we do not check the organization slug,
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
