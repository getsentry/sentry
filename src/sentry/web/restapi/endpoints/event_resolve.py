from django.utils import timezone
from django.utils.decorators import method_decorator

from sentry.constants import STATUS_RESOLVED
from sentry.models import Activity, Group
from sentry.web.decorators import has_access
from sentry.web.restapi.base import BaseView
from sentry.utils.javascript import transform

from rest_framework.response import Response


class ResolveEventView(BaseView):
    @method_decorator(has_access)
    def post(self, request, team, project, group_id):
        group = Group.objects.get(
            id=group_id,
            project=project,
        )

        now = timezone.now()

        happened = Group.objects.filter(
            id=group.id,
        ).exclude(status=STATUS_RESOLVED).update(
            status=STATUS_RESOLVED,
            resolved_at=now,
        )
        group.status = STATUS_RESOLVED
        group.resolved_at = now

        if happened:
            Activity.objects.create(
                project=project,
                group=group,
                type=Activity.SET_RESOLVED,
                user=request.user,
            )

        return Response(transform(group, request))
