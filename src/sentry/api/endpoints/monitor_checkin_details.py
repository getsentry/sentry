from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from sentry import features
from sentry.api.authentication import DSNAuthentication
from sentry.api.base import Endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize
from sentry.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorStatus,
    Project,
    ProjectKey,
    ProjectStatus,
)
from sentry.utils.sdk import bind_organization_context, configure_scope


class CheckInSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            ("ok", CheckInStatus.OK),
            ("error", CheckInStatus.ERROR),
            ("in_progress", CheckInStatus.IN_PROGRESS),
        )
    )
    duration = EmptyIntegerField(required=False, allow_null=True)


class MonitorCheckInDetailsEndpoint(Endpoint):
    authentication_classes = Endpoint.authentication_classes + (DSNAuthentication,)
    permission_classes = (ProjectPermission,)

    # TODO(dcramer): this code needs shared with other endpoints as its security focused
    # TODO(dcramer): this doesnt handle is_global roles
    def convert_args(self, request, monitor_id, checkin_id, *args, **kwargs):
        try:
            monitor = Monitor.objects.get(guid=monitor_id)
        except Monitor.DoesNotExist:
            raise ResourceDoesNotExist

        project = Project.objects.get_from_cache(id=monitor.project_id)
        if project.status != ProjectStatus.VISIBLE:
            raise ResourceDoesNotExist

        if hasattr(request.auth, "project_id") and project.id != request.auth.project_id:
            return self.respond(status=400)

        if not features.has("organizations:monitors", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("project", project.id)

        bind_organization_context(project.organization)

        try:
            checkin = MonitorCheckIn.objects.get(monitor=monitor, guid=checkin_id)
        except MonitorCheckIn.DoesNotExist:
            raise ResourceDoesNotExist

        request._request.organization = project.organization

        kwargs.update({"checkin": checkin, "monitor": monitor, "project": project})
        return (args, kwargs)

    def get(self, request, project, monitor, checkin):
        """
        Retrieve a check-in
        ```````````````````

        :pparam string monitor_id: the id of the monitor.
        :pparam string checkin_id: the id of the check-in.
        :auth: required
        """
        # we don't allow read permission with DSNs
        if isinstance(request.auth, ProjectKey):
            return self.respond(status=401)

        return self.respond(serialize(checkin, request.user))

    def put(self, request, project, monitor, checkin):
        """
        Update a check-in
        `````````````````

        :pparam string monitor_id: the id of the monitor.
        :pparam string checkin_id: the id of the check-in.
        :auth: required
        """
        if checkin.status in CheckInStatus.FINISHED_VALUES:
            return self.respond(status=400)

        serializer = CheckInSerializer(
            data=request.data, partial=True, context={"project": project, "request": request}
        )
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        result = serializer.validated_data

        current_datetime = timezone.now()
        params = {"date_updated": current_datetime}
        if "duration" in result:
            params["duration"] = result["duration"]
        if "status" in result:
            params["status"] = getattr(CheckInStatus, result["status"].upper())

        with transaction.atomic():
            checkin.update(**params)
            if checkin.status == CheckInStatus.ERROR:
                if not monitor.mark_failed(current_datetime):
                    return self.respond(serialize(checkin, request.user), status=208)
            else:
                monitor_params = {
                    "last_checkin": current_datetime,
                    "next_checkin": monitor.get_next_scheduled_checkin(current_datetime),
                }
                if checkin.status == CheckInStatus.OK:
                    monitor_params["status"] = MonitorStatus.OK
                Monitor.objects.filter(id=monitor.id).exclude(
                    last_checkin__gt=current_datetime
                ).update(**monitor_params)

        return self.respond(serialize(checkin, request.user))
