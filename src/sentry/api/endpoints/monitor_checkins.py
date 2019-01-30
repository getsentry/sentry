from __future__ import absolute_import

from django.db import transaction
from rest_framework import serializers

from sentry import features
from sentry.api.authentication import DSNAuthentication
from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.bases.project import ProjectPermission
from sentry.api.serializers import serialize
from sentry.models import Monitor, MonitorCheckIn, MonitorStatus, CheckInStatus, Project, ProjectKey, ProjectStatus
from sentry.utils.sdk import configure_scope


class CheckInSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            ('ok', CheckInStatus.OK),
            ('error', CheckInStatus.ERROR),
            ('in_progress', CheckInStatus.IN_PROGRESS),
        ),
    )
    duration = serializers.IntegerField(required=False)


class MonitorCheckInsEndpoint(Endpoint):
    authentication_classes = Endpoint.authentication_classes + (DSNAuthentication,)
    permission_classes = (ProjectPermission,)

    # TODO(dcramer): this code needs shared with other endpoints as its security focused
    # TODO(dcramer): this doesnt handle is_global roles
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

    def get(self, request, project, monitor):
        """
        Retrieve check-ins for an monitor
        `````````````````````````````````

        :pparam string monitor_id: the id of the monitor.
        :auth: required
        """
        # we dont allow read permission with DSNs
        if isinstance(request.auth, ProjectKey):
            return self.respond(status=401)

        queryset = MonitorCheckIn.objects.filter(
            monitor_id=monitor.id,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='name',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request, project, monitor):
        """
        Create a new check-in for a monitor
        ```````````````````````````````````

        :pparam string monitor_id: the id of the monitor.
        :auth: required
        """
        serializer = CheckInSerializer(
            data=request.DATA,
            context={
                'project': project,
                'request': request,
            },
        )
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        result = serializer.object

        with transaction.atomic():
            checkin = MonitorCheckIn.objects.create(
                project_id=project.id,
                monitor_id=monitor.id,
                duration=result.get('duration'),
                status=getattr(CheckInStatus, result['status'].upper()),
            )
            if checkin.status == CheckInStatus.ERROR:
                monitor.mark_failed(last_checkin=checkin.date_added)
            else:
                monitor_params = {
                    'last_checkin': checkin.date_added,
                    'next_checkin': monitor.get_next_scheduled_checkin(checkin.date_added),
                }
                if checkin.status == CheckInStatus.OK:
                    monitor_params['status'] = MonitorStatus.OK
                Monitor.objects.filter(
                    id=monitor.id,
                ).exclude(
                    last_checkin__gt=checkin.date_added,
                ).update(**monitor_params)

        return self.respond(serialize(checkin, request.user))
