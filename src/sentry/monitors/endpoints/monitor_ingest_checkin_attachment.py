from __future__ import annotations

from uuid import UUID

from django.core.files.uploadedfile import UploadedFile
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import (
    ApiKeyAuthentication,
    DSNAuthentication,
    OrgAuthTokenAuthentication,
    UserAuthTokenAuthentication,
)
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.exceptions import ParameterValidationError, ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models.files.file import File
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.monitors.models import Monitor, MonitorCheckIn
from sentry.utils.sdk import bind_organization_context

from .base import ProjectMonitorPermission, get_monitor_by_org_id_or_slug, try_checkin_lookup

MAX_ATTACHMENT_SIZE = 1024 * 100  # 100kb


@region_silo_endpoint
class MonitorIngestCheckinAttachmentEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    authentication_classes = (
        DSNAuthentication,
        UserAuthTokenAuthentication,
        OrgAuthTokenAuthentication,
        ApiKeyAuthentication,
    )
    permission_classes = (ProjectMonitorPermission,)

    """
    Loosens the base endpoint such that a monitor with the provided monitor_id_or_slug
    does not need to exist. This is used for initial checkin creation with
    monitor upsert.

    [!!]: This will ONLY work when using DSN auth.
    """

    def convert_args(
        self,
        request: Request,
        monitor_id_or_slug: int | str,
        checkin_id: str,
        organization_id_or_slug: int | str | None = None,
        *args,
        **kwargs,
    ):
        monitor = None

        using_dsn_auth = isinstance(request.auth, ProjectKey)
        if checkin_id != "latest":
            # We require a checkin for this endpoint. If one doesn't exist then error. If the
            # checkin_id is `latest` we'll need to resolve the monitor before we can get it.
            try:
                UUID(checkin_id)
            except ValueError:
                raise ParameterValidationError("Invalid check-in UUID")

            try:
                checkin = MonitorCheckIn.objects.select_related("monitor").get(guid=checkin_id)
                monitor = checkin.monitor
                project = Project.objects.select_related("organization").get(id=monitor.project_id)
            except (MonitorCheckIn.DoesNotExist, Project.DoesNotExist):
                raise ResourceDoesNotExist
        else:

            # When using DSN auth we're able to infer the organization slug (organization_id_or_slug is slug in this case)
            if not organization_id_or_slug and using_dsn_auth:
                organization_id_or_slug = request.auth.project.organization.slug

            # The only monitor endpoints that do not have the org id or slug in their
            # parameters are the GUID-style checkin endpoints
            if organization_id_or_slug:
                try:
                    # Try lookup by id or slug first. This requires organization context.
                    if str(organization_id_or_slug).isdecimal():
                        organization = Organization.objects.get_from_cache(
                            id=organization_id_or_slug
                        )
                    else:
                        organization = Organization.objects.get_from_cache(
                            slug=organization_id_or_slug
                        )

                    monitor = get_monitor_by_org_id_or_slug(organization, monitor_id_or_slug)
                except (Organization.DoesNotExist, Monitor.DoesNotExist):
                    pass

            # Try lookup by GUID
            if not monitor:
                # Validate GUIDs
                try:
                    UUID(monitor_id_or_slug)
                    # When looking up by guid we don't include the org conditional
                    # (since GUID lookup allows orgless routes), we will validate
                    # permissions later in this function
                    try:
                        monitor = Monitor.objects.get(guid=monitor_id_or_slug)
                    except Monitor.DoesNotExist:
                        monitor = None
                except ValueError:
                    # This error is a bit confusing, because this may also mean
                    # that we've failed to look up their monitor by slug.
                    raise ParameterValidationError("Invalid monitor UUID")

            if not monitor:
                raise ResourceDoesNotExist

            project = Project.objects.get_from_cache(id=monitor.project_id)
            checkin = try_checkin_lookup(monitor, checkin_id)

        if project.status != ObjectStatus.ACTIVE:
            raise ResourceDoesNotExist

        # Validate that the authenticated project matches the monitor. This is
        # used for DSN style authentication
        if using_dsn_auth and project.id != request.auth.project_id:
            raise ResourceDoesNotExist

        # When looking up via GUID we do not check the organization slug,
        # validate that the slug matches the org of the monitors project

        # We only raise if the organization_id_or_slug was set and it doesn't match.
        if (
            organization_id_or_slug
            and project.organization.slug != organization_id_or_slug
            and project.organization.id != organization_id_or_slug
        ):
            raise ResourceDoesNotExist

        # Check project permission. Required for Token style authentication
        self.check_object_permissions(request, project)

        Scope.get_isolation_scope().set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization
        kwargs["checkin"] = checkin

        return args, kwargs

    def post(self, request: Request, checkin) -> Response:
        """
        Uploads a check-in attachment file.

        Unlike other API requests, files must be uploaded using the traditional multipart/form-data content type.
        """
        if "file" not in request.data:
            return Response({"detail": "Missing uploaded file"}, status=400)

        if checkin.attachment_id:
            return Response({"detail": "Check-in already has an attachment"}, status=400)

        fileobj = request.data["file"]
        if not isinstance(fileobj, UploadedFile):
            return Response({"detail": "Please upload a valid file object"}, status=400)

        if fileobj.size > MAX_ATTACHMENT_SIZE:
            return Response({"detail": "Please keep uploads below 100kb"}, status=400)

        headers = {"Content-Type": fileobj.content_type}

        file = File.objects.create(name=fileobj.name, type="checkin.attachment", headers=headers)
        file.putfile(fileobj)

        checkin.update(attachment_id=file.id)
        return self.respond(serialize(checkin, request.user))
