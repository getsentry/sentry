from __future__ import absolute_import

from django.utils import timezone
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.db.models import create_or_update
from sentry.constants import STATUS_RESOLVED
from sentry.models import Group, Activity


class GroupResolveEndpoint(Endpoint):
    def post(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        now = timezone.now()

        group.resolved_at = now

        happened = Group.objects.filter(
            id=group.id,
        ).exclude(status=STATUS_RESOLVED).update(
            status=STATUS_RESOLVED,
            resolved_at=now,
        )

        if happened:
            create_or_update(
                Activity,
                project=group.project,
                group=group,
                type=Activity.SET_RESOLVED,
                user=request.user,
            )

        return Response()
