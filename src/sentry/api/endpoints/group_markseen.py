from __future__ import absolute_import

from django.utils import timezone
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.db.models import create_or_update
from sentry.models import Project, Group, GroupSeen
from sentry.utils.functional import extract_lazy_object


class GroupMarkSeenEndpoint(Endpoint):
    def post(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        if group.project not in Project.objects.get_for_user(
                team=group.project.team, user=request.user):
            return Response(status=400)

        instance, created = create_or_update(
            GroupSeen,
            group=group,
            user=extract_lazy_object(request.user),
            project=group.project,
            defaults={
                'last_seen': timezone.now(),
            }
        )
        if created:
            return Response(status=201)
        return Response(status=204)
